import "server-only";
import crypto from "node:crypto";
import Stripe from "stripe";
import { one, query } from "./db";
import { assertStripeKeyAllowed, serverEnv, siteUrl } from "./env";
import { recordServerEvent } from "./server-utils";

/**
 * Paiement : Stripe Checkout (page hébergée par Stripe). Aucune donnée de
 * carte ne transite par nos serveurs. Le statut d'un paiement n'est modifié
 * QUE par un webhook signé : la page de retour "succès" n'est qu'un
 * affichage et ne valide rien.
 */

export type Order = {
  id: string;
  ref: string;
  customer_name: string;
  customer_email: string;
  client_type: "pro" | "particulier";
  label: string;
  total_cents: number;
  deposit_cents: number;
  currency: string;
  status: string;
  pay_token: string;
  terms_version: string;
  waiver_at: Date | null;
  created_at: Date;
};

export type Payment = {
  id: string;
  order_id: string;
  kind: "acompte" | "solde" | "total";
  amount_cents: number;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  refunded_cents: number;
  livemode: boolean;
  created_at: Date;
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  en_attente_acompte: "En attente d'acompte",
  acompte_paye: "Acompte payé, solde à régler",
  paye: "Payée",
  annule: "Annulée",
  rembourse: "Remboursée",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  cree: "Créé",
  en_cours: "En cours (paiement différé)",
  reussi: "Réussi",
  echoue: "Échoué",
  expire: "Expiré / abandonné",
  rembourse: "Remboursé",
  rembourse_partiel: "Remboursé partiellement",
};

/** Ordre des statuts d'un paiement : seules les transitions vers l'avant sont appliquées. */
const STATUS_RANK: Record<string, number> = { cree: 0, expire: 1, echoue: 1, en_cours: 2, reussi: 3, rembourse_partiel: 4, rembourse: 5 };

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  const key = serverEnv().stripeSecretKey;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configurée.");
  assertStripeKeyAllowed(key);
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export function stripeConfigured(): boolean {
  return !!serverEnv().stripeSecretKey;
}

export async function getOrderByToken(tok: string) {
  return one<Order>(`SELECT * FROM orders WHERE pay_token = $1`, [tok]);
}

export async function getPayments(orderId: string) {
  return query<Payment>(`SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at`, [orderId]);
}

/** Montant net encaissé (paiements réussis moins remboursements). */
export function paidCents(payments: Payment[]): number {
  return payments
    .filter((p) => p.status === "reussi" || p.status.startsWith("rembourse"))
    .reduce((s, p) => s + p.amount_cents - p.refunded_cents, 0);
}

/** Prochaine échéance d'une commande, ou null si rien n'est dû. */
export function nextDue(order: Order, payments: Payment[]): { kind: Payment["kind"]; amount: number } | null {
  if (order.status === "annule" || order.status === "rembourse") return null;
  if (payments.some((p) => p.status === "en_cours")) return null; // paiement différé en attente
  const gross = payments.filter((p) => p.status === "reussi" || p.status.startsWith("rembourse")).reduce((s, p) => s + p.amount_cents, 0);
  if (gross === 0 && order.deposit_cents > 0 && order.deposit_cents < order.total_cents) return { kind: "acompte", amount: order.deposit_cents };
  const remaining = order.total_cents - gross;
  if (remaining <= 0) return null;
  return { kind: gross === 0 ? "total" : "solde", amount: remaining };
}

export async function createOrder(input: {
  quoteId?: string | null;
  customerName: string;
  customerEmail: string;
  clientType: "pro" | "particulier";
  label: string;
  totalCents: number;
  depositCents: number;
  termsVersion: string;
}) {
  const { makeRef, token } = await import("./server-utils");
  const id = crypto.randomUUID();
  const ref = makeRef("C");
  const payToken = token();
  await query(
    `INSERT INTO orders (id, ref, quote_id, customer_name, customer_email, client_type, label, total_cents, deposit_cents, pay_token, terms_version, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, ref, input.quoteId ?? null, input.customerName, input.customerEmail.toLowerCase(), input.clientType, input.label, input.totalCents, input.depositCents, payToken, input.termsVersion, "en_attente_acompte"],
  );
  return { id, ref, payToken };
}

/**
 * Crée la session Checkout pour la prochaine échéance. Le montant vient de
 * la base, jamais du navigateur.
 */
export async function createCheckout(order: Order, opts: { waiver: boolean; acceptTerms: boolean }) {
  const payments = await getPayments(order.id);
  const due = nextDue(order, payments);
  if (!due) throw new Error("Aucun montant dû pour cette commande.");
  if (!opts.acceptTerms) throw new Error("Acceptation des CGV requise.");
  await query(`UPDATE orders SET terms_accepted_at = now() WHERE id = $1`, [order.id]);
  if (order.client_type === "particulier" && !order.waiver_at && !opts.waiver) {
    throw new Error("Demande d'exécution immédiate requise.");
  }
  if (order.client_type === "particulier" && !order.waiver_at && opts.waiver) {
    await query(`UPDATE orders SET waiver_at = now() WHERE id = $1`, [order.id]);
  }

  // Une seule session payable à la fois : on clôt les sessions encore ouvertes
  // avant d'en créer une nouvelle (sinon deux onglets = deux encaissements).
  await closeOpenSessions(order.id);
  const paymentId = crypto.randomUUID();
  try {
    await query(`INSERT INTO payments (id, order_id, kind, amount_cents) VALUES ($1,$2,$3,$4)`, [paymentId, order.id, due.kind, due.amount]);
  } catch {
    // Index unique "une échéance ouverte par commande" : requête concurrente.
    throw new Error("Un paiement est déjà en cours de création pour cette commande.");
  }

  const label = { acompte: "Acompte", solde: "Solde", total: "Règlement" }[due.kind];
  const base = siteUrl();
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: order.customer_email,
      client_reference_id: order.ref,
      locale: "fr",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency,
            unit_amount: due.amount,
            product_data: { name: `${label} · ${order.label}`, description: `Commande ${order.ref}` },
          },
        },
      ],
      metadata: { order_id: order.id, payment_id: paymentId, kind: due.kind },
      payment_intent_data: { metadata: { order_id: order.id, payment_id: paymentId }, description: `${order.ref} ${label}` },
      success_url: `${base}/paiement/${order.pay_token}?retour=succes`,
      cancel_url: `${base}/paiement/${order.pay_token}?retour=annule`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    { idempotencyKey: `checkout-${paymentId}` },
  );
  await query(`UPDATE payments SET stripe_session_id = $1, livemode = $2, updated_at = now() WHERE id = $3`, [session.id, session.livemode, paymentId]);
  await recordServerEvent("checkout_started", { order: order.ref, kind: due.kind, amount_cents: due.amount });
  return session.url!;
}

/**
 * Expire chez Stripe les sessions encore ouvertes d'une commande et les
 * marque "expire". Si Stripe répond qu'une session est déjà payée, on
 * s'arrête : le webhook va l'enregistrer, il ne faut pas en créer d'autre.
 */
export async function closeOpenSessions(orderId: string) {
  const open = await query<Payment>(`SELECT * FROM payments WHERE order_id = $1 AND status = 'cree'`, [orderId]);
  for (const p of open) {
    if (p.stripe_session_id && stripeConfigured()) {
      const s = await getStripe().checkout.sessions.retrieve(p.stripe_session_id);
      if (s.status === "complete") throw new Error("Un paiement vient d'aboutir pour cette commande. Actualisez la page.");
      if (s.status === "open") await getStripe().checkout.sessions.expire(p.stripe_session_id);
    }
    await query(`UPDATE payments SET status = 'expire', updated_at = now() WHERE id = $1 AND status = 'cree'`, [p.id]);
  }
}

/** Anomalie d'encaissement : enregistrée et signalée, jamais ignorée en silence. */
async function flagAnomaly(reason: string, details: Record<string, unknown>) {
  console.error(`[paiement] anomalie : ${reason}`, details);
  await recordServerEvent("payment_anomaly", { reason, ...details });
  const { notify } = await import("./server-utils");
  await notify(`Anomalie de paiement : ${reason}`, JSON.stringify(details, null, 2));
}

async function refreshOrderStatus(orderId: string) {
  const order = await one<Order>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) return;
  const payments = await getPayments(orderId);
  if (order.status === "annule") {
    // Commande annulée mais argent encaissé : à rembourser ou à réactiver, par un humain.
    if (payments.some((p) => p.status === "reussi")) await flagAnomaly("paiement reçu sur une commande annulée", { order: order.ref });
    return;
  }
  const gross = payments.filter((p) => p.status === "reussi" || p.status.startsWith("rembourse")).reduce((s, p) => s + p.amount_cents, 0);
  const refunded = payments.reduce((s, p) => s + p.refunded_cents, 0);
  let status = order.status;
  if (gross > 0 && refunded >= gross) status = "rembourse";
  else if (gross >= order.total_cents) status = "paye";
  else if (gross > 0) status = "acompte_paye";
  else status = "en_attente_acompte";
  if (status !== order.status) await query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, orderId]);
  if (gross > order.total_cents) await flagAnomaly("montant encaissé supérieur au total", { order: order.ref, gross, total: order.total_cents });
}

/**
 * Traitement d'un événement Stripe DÉJÀ vérifié (signature contrôlée par
 * la route webhook). Idempotent : un même événement n'est appliqué qu'une fois.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const inserted = await query(`INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`, [event.id, event.type]);
  if (!inserted.length) return "duplicate";
  try {
    return await applyStripeEvent(event);
  } catch (e) {
    // Échec : on libère l'événement pour que la relance de Stripe le retraite.
    await query(`DELETE FROM stripe_events WHERE id = $1`, [event.id]).catch(() => {});
    throw e;
  }
}

async function applyStripeEvent(event: Stripe.Event): Promise<"processed" | "ignored"> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const pay = await one<Payment>(`SELECT * FROM payments WHERE stripe_session_id = $1`, [s.id]);
      if (!pay) return "ignored";
      // Contrôle d'intégrité : le montant encaissé doit correspondre à l'échéance.
      if (s.amount_total !== null && s.amount_total !== pay.amount_cents) {
        await flagAnomaly("montant Stripe différent de l'échéance", { session: s.id, stripe: s.amount_total, attendu: pay.amount_cents });
        return "ignored";
      }
      let status = pay.status;
      if (event.type === "checkout.session.expired") status = pay.status === "reussi" ? pay.status : "expire";
      else if (event.type === "checkout.session.async_payment_failed") status = "echoue";
      else if (event.type === "checkout.session.async_payment_succeeded") status = "reussi";
      else status = s.payment_status === "paid" ? "reussi" : "en_cours";

      const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
      // Les webhooks peuvent arriver dans le désordre : un statut ne recule jamais.
      const failedAfterPending = pay.status === "en_cours" && status === "echoue";
      if (status !== pay.status && STATUS_RANK[status] <= STATUS_RANK[pay.status] && !failedAfterPending) return "ignored";
      await query(
        `UPDATE payments SET status = $1, stripe_payment_intent = COALESCE($2, stripe_payment_intent), updated_at = now(),
                paid_at = CASE WHEN $1 = 'reussi' AND paid_at IS NULL THEN now() ELSE paid_at END
          WHERE id = $3`,
        [status, pi, pay.id],
      );
      await refreshOrderStatus(pay.order_id);
      if (status === "reussi" && pay.status !== "reussi")
        await recordServerEvent("payment_succeeded", { payment: pay.id, kind: pay.kind, amount_cents: pay.amount_cents, livemode: event.livemode });
      if (status === "echoue") await recordServerEvent("payment_failed", { payment: pay.id, kind: pay.kind });
      return "processed";
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (!pi) return "ignored";
      const pay = await one<Payment>(`SELECT * FROM payments WHERE stripe_payment_intent = $1`, [pi]);
      if (!pay) return "ignored";
      // amount_refunded est cumulatif : on ne garde que le plus grand (ordre d'arrivée non garanti).
      const refunded = Math.max(pay.refunded_cents, Math.min(ch.amount_refunded, pay.amount_cents));
      const status = refunded >= pay.amount_cents ? "rembourse" : "rembourse_partiel";
      await query(`UPDATE payments SET refunded_cents = $1, status = $2, updated_at = now() WHERE id = $3`, [refunded, status, pay.id]);
      await refreshOrderStatus(pay.order_id);
      await recordServerEvent("payment_refunded", { payment: pay.id, refunded_cents: refunded });
      return "processed";
    }
    default:
      return "ignored";
  }
}

export async function refundPayment(paymentId: string, amountCents?: number) {
  const pay = await one<Payment>(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  if (!pay?.stripe_payment_intent) throw new Error("Paiement introuvable ou non encaissé.");
  // Le statut sera mis à jour par le webhook charge.refunded.
  return getStripe().refunds.create(
    { payment_intent: pay.stripe_payment_intent, ...(amountCents ? { amount: amountCents } : {}) },
    { idempotencyKey: `refund-${paymentId}-${amountCents ?? "full"}-${Math.floor(Date.now() / 600_000)}` },
  );
}

export function formatEuros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
