"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearSessionCookie, requireAdmin, setSessionCookie, verifyPassword } from "@/lib/admin-auth";
import { POLICY_VERSION } from "@/lib/consent";
import { dbConfigured, one, query } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { closeOpenSessions, createOrder, refundPayment } from "@/lib/payments";
import { rateLimit } from "@/lib/server-utils";

async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return crypto.createHmac("sha256", serverEnv().ipHashSalt).update(ip).digest("base64url").slice(0, 22);
}

export async function login(_: unknown, formData: FormData): Promise<{ error?: string }> {
  if (!dbConfigured()) return { error: "L'espace privé n'est pas activé sur cette version d'aperçu (aucune base de données)." };
  // 5 tentatives par quart d'heure et par IP, puis blocage temporaire.
  if (!(await rateLimit(`login:${await clientKey()}`, 5, 900))) return { error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const password = String(formData.get("password") ?? "");
  const hash = serverEnv().adminPasswordHash;
  if (!hash) return { error: "Admin non configuré : ADMIN_PASSWORD_HASH manquant." };
  if (!verifyPassword(password, hash)) return { error: "Mot de passe incorrect." };
  await setSessionCookie();
  redirect("/admin");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/admin/login");
}

const QUOTE_STATUSES = ["nouveau", "en_cours", "devis_envoye", "accepte", "refuse", "archive"] as const;

export async function updateQuote(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const status = z.enum(QUOTE_STATUSES).parse(formData.get("status"));
  const notes = z.string().max(5000).parse(formData.get("notes") ?? "");
  await query(`UPDATE quotes SET status = $1, admin_notes = $2 WHERE id = $3`, [status, notes || null, id]);
  revalidatePath("/admin/demandes");
}

const euros = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s/g, "").replace(",", "."))
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide"))
  .transform((s) => Math.round(Number(s) * 100));

export async function createOrderAction(_: unknown, formData: FormData): Promise<{ error?: string; link?: string }> {
  await requireAdmin();
  const parsed = z
    .object({
      quoteId: z.uuid().optional().or(z.literal("")),
      customerName: z.string().trim().min(2).max(120),
      customerEmail: z.email(),
      clientType: z.enum(["pro", "particulier"]),
      label: z.string().trim().min(3).max(160),
      total: euros,
      deposit: euros,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${String(i.path[0])} : ${i.message}`).join(" · ") };
  const d = parsed.data;
  if (d.total <= 0) return { error: "Le total doit être positif." };
  if (d.deposit > d.total) return { error: "L'acompte ne peut pas dépasser le total." };
  const { payToken, ref } = await createOrder({
    quoteId: d.quoteId || null,
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    clientType: d.clientType,
    label: d.label,
    totalCents: d.total,
    depositCents: d.deposit,
    termsVersion: POLICY_VERSION,
  });
  if (d.quoteId) await query(`UPDATE quotes SET status = 'accepte' WHERE id = $1`, [d.quoteId]);
  revalidatePath("/admin/commandes");
  return { link: `/paiement/${payToken}`, error: undefined, ...{ ref } };
}

export async function cancelOrder(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const order = await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [id]);
  if (order && order.status === "en_attente_acompte") {
    // Le lien de paiement ne doit plus pouvoir aboutir : on expire les sessions ouvertes d'abord.
    try {
      await closeOpenSessions(id);
    } catch (e) {
      redirect(`/admin/commandes?erreur=${encodeURIComponent(e instanceof Error ? e.message : "Annulation impossible")}`);
    }
    await query(`UPDATE orders SET status = 'annule' WHERE id = $1`, [id]);
  }
  revalidatePath("/admin/commandes");
}

export async function refundAction(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("paymentId"));
  if (formData.get("confirm") !== "REMBOURSER") redirect(`/admin/commandes?erreur=${encodeURIComponent("Tapez REMBOURSER pour confirmer.")}`);
  try {
    await refundPayment(id);
  } catch (e) {
    redirect(`/admin/commandes?erreur=${encodeURIComponent(e instanceof Error ? e.message : "Remboursement impossible")}`);
  }
  redirect(`/admin/commandes?info=${encodeURIComponent("Remboursement demandé à Stripe. Le statut sera mis à jour à réception de la confirmation.")}`);
}
