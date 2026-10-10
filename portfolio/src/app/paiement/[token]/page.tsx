import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { site } from "@/lib/content";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, createCheckout, formatEuros, getOrderByToken, getPayments, nextDue, paidCents, stripeConfigured } from "@/lib/payments";

export const metadata: Metadata = { title: "Paiement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function pay(formData: FormData) {
  "use server";
  const tok = String(formData.get("token") ?? "");
  const order = await getOrderByToken(tok);
  if (!order) notFound();
  let url: string;
  try {
    url = await createCheckout(order, { waiver: formData.get("waiver") === "on", acceptTerms: formData.get("terms") === "on" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erreur";
    redirect(`/paiement/${tok}?erreur=${encodeURIComponent(msg)}`);
  }
  redirect(url);
}

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const payments = await getPayments(order.id);
  const due = nextDue(order, payments);
  const paid = paidCents(payments);
  const b2c = order.client_type === "particulier";
  const enabled = stripeConfigured();

  return (
    <div className="mx-auto max-w-2xl px-5 pb-10 pt-20 sm:pt-24">
      <p className="t-eyebrow">Commande {order.ref}</p>
      <h1 className="t-display mt-2 text-4xl sm:text-5xl">{order.label}</h1>
      <p className="mt-2 text-[var(--color-muted)]">Pour {order.customer_name} · {ORDER_STATUS_LABEL[order.status] ?? order.status}</p>

      {sp.retour === "succes" && (
        <p role="status" className="mt-6 rounded-2xl border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 p-4 text-sm">
          Merci. Stripe nous transmet la confirmation du paiement : le statut ci-dessous se met à jour dès sa réception (quelques secondes, parfois plus pour un virement ou un prélèvement).
        </p>
      )}
      {sp.retour === "annule" && (
        <p role="status" className="mt-6 rounded-2xl border border-[var(--color-line)] p-4 text-sm">Paiement annulé, rien n'a été débité. Vous pouvez réessayer quand vous voulez.</p>
      )}
      {sp.erreur && (
        <p role="alert" className="mt-6 rounded-2xl bg-[var(--color-accent)]/12 p-4 text-sm text-[#ffb9a8]">{sp.erreur === "Demande d'exécution immédiate requise." ? "Merci de cocher la case de demande d'exécution avant la fin du délai de rétractation, ou de nous contacter." : sp.erreur === "Acceptation des CGV requise." ? "Merci d'accepter les conditions générales de vente." : "Le paiement n'a pas pu être lancé. Réessayez ou contactez-nous."}</p>
      )}

      <dl className="mt-8 divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]">
        <Row k="Montant total TTC" v={formatEuros(order.total_cents)} />
        {order.deposit_cents > 0 && order.deposit_cents < order.total_cents && <Row k="Acompte" v={formatEuros(order.deposit_cents)} />}
        <Row k="Déjà réglé" v={formatEuros(paid)} />
        {due && <Row k={due.kind === "acompte" ? "À régler maintenant (acompte)" : "À régler maintenant"} v={formatEuros(due.amount)} strong />}
      </dl>

      {payments.length > 0 && (
        <details className="mt-4 text-sm text-[var(--color-muted)]">
          <summary className="cursor-pointer">Historique des paiements</summary>
          <ul className="mt-2 space-y-1">
            {payments.map((p) => (
              <li key={p.id}>{new Date(p.created_at).toLocaleDateString("fr-FR")} · {p.kind} · {formatEuros(p.amount_cents)} · {PAYMENT_STATUS_LABEL[p.status] ?? p.status}</li>
            ))}
          </ul>
        </details>
      )}

      {due ? (
        enabled ? (
          <form action={pay} className="mt-8 space-y-4">
            <input type="hidden" name="token" value={token} />
            <div className="rounded-2xl border border-[var(--color-line)] p-4 text-sm text-[#d9d5cc]">
              <p className="font-semibold text-[var(--color-fg)]">Avant de payer</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Prestataire : {site.legal.publisherName}{site.legal.siret ? `, SIRET ${site.legal.siret}` : ""}. Contact : {site.contact.email}.</li>
                <li>Prestation : {order.label}, selon le devis accepté. Prix TTC indiqué ci-dessus{site.legal.vatNote ? ` (${site.legal.vatNote})` : ""}.</li>
                <li>Paiement sécurisé par Stripe : vos données de carte ne transitent pas par ce site.</li>
                <li>Conditions applicables : <Link href="/cgv" className="underline">conditions générales de vente</Link> (version {order.terms_version}).</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-line)] p-4 text-sm">
              <input type="checkbox" name="terms" required className="mt-1 h-5 w-5 accent-[var(--color-accent)]" />
              <span>J'ai lu et j'accepte les <Link href="/cgv" className="underline">conditions générales de vente</Link> (version {order.terms_version}).</span>
            </label>
            {b2c && !order.waiver_at && (
              <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-line)] p-4 text-sm">
                <input type="checkbox" name="waiver" required className="mt-1 h-5 w-5 accent-[var(--color-accent)]" />
                <span>
                  Je demande expressément que la prestation commence avant la fin du délai de rétractation de 14 jours. Je reconnais
                  que si la prestation est entièrement exécutée avant la fin de ce délai, je perds mon droit de rétractation, et que
                  si je me rétracte après son commencement, je devrai payer la part déjà exécutée.{" "}
                  <Link href="/retractation" className="underline">Formulaire de rétractation</Link>.
                </span>
              </label>
            )}
            <button type="submit" className="btn btn-primary w-full !min-h-[52px] text-base">
              Payer {formatEuros(due.amount)} avec Stripe
            </button>
            <p className="text-center text-xs text-[var(--color-muted)]">Carte bancaire, Apple Pay, Google Pay et autres moyens selon votre appareil.</p>
          </form>
        ) : (
          <p className="mt-8 rounded-2xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-4 text-sm">
            Le paiement en ligne n'est pas encore activé. Contactez <a className="underline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a> pour régler cette commande.
          </p>
        )
      ) : (
        <p className="mt-8 rounded-2xl border border-[var(--color-line)] p-4 text-sm">Rien à régler pour le moment.</p>
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <dt className="text-[var(--color-muted)]">{k}</dt>
      <dd className={strong ? "t-display text-2xl" : "font-semibold"}>{v}</dd>
    </div>
  );
}
