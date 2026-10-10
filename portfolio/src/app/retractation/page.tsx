import type { Metadata } from "next";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/lib/db";
import { makeRef, notify, rateLimit } from "@/lib/server-utils";

export const metadata: Metadata = { title: "Rétractation", alternates: { canonical: "/retractation" } };

const input = z.object({
  orderRef: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  message: z.string().trim().max(2000).optional(),
});

async function submit(formData: FormData) {
  "use server";
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "x";
  if (!(await rateLimit(`wd:${crypto.createHash("sha256").update(ip).digest("hex").slice(0, 20)}`, 5, 3600))) redirect("/retractation?erreur=1");
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/retractation?erreur=1");
  const d = parsed.data;
  const ref = makeRef("R");
  await query(`INSERT INTO withdrawals (id, ref, order_ref, name, email, message) VALUES ($1,$2,$3,$4,$5,$6)`, [crypto.randomUUID(), ref, d.orderRef || null, d.name, d.email, d.message || null]);
  await notify(`Demande de rétractation ${ref}`, `${d.name} <${d.email}>\nCommande : ${d.orderRef || "-"}\n\n${d.message ?? ""}`);
  redirect(`/retractation?ok=${ref}`);
}

/**
 * Fonction de rétractation en ligne pour les consommateurs. La demande est
 * horodatée et un accusé de réception (référence + date) est affiché ; il
 * doit aussi être envoyé par e-mail (voir docs : envoi client à activer).
 */
export default async function RetractationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-5 pb-10 pt-20 sm:pt-24">
      <p className="t-eyebrow">Consommateurs</p>
      <h1 className="t-display mt-2 text-4xl">Se rétracter</h1>
      <p className="mt-3 text-[#d9d5cc]">
        Si vous avez commandé à titre personnel, vous disposez en principe de 14 jours pour vous rétracter, sauf exceptions prévues par la loi
        (notamment une prestation pleinement exécutée à votre demande expresse avant la fin du délai). Les conditions sont détaillées dans les CGV.
      </p>
      {sp.ok ? (
        <p role="status" className="mt-8 rounded-2xl border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 p-4">
          Demande enregistrée le {new Date().toLocaleString("fr-FR")} sous la référence <b className="t-mono">{sp.ok.replace(/[^A-Z0-9-]/g, "")}</b>. Conservez cette référence.
        </p>
      ) : (
        <form action={submit} className="mt-8 grid gap-4">
          {sp.erreur && <p role="alert" className="rounded-xl bg-[var(--color-accent)]/12 p-3 text-sm text-[#ffb9a8]">Vérifiez les champs et réessayez.</p>}
          <label className="grid gap-1.5 text-sm font-semibold">Référence de commande (C-...)<input name="orderRef" className="input" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Nom<input name="name" required autoComplete="name" className="input" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">E-mail<input name="email" type="email" required autoComplete="email" className="input" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Message (facultatif)<textarea name="message" rows={3} className="input" /></label>
          <button type="submit" className="btn btn-primary">Confirmer ma rétractation</button>
        </form>
      )}
    </div>
  );
}
