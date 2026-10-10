import { requireAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { updateQuote } from "../actions";
import { OrderForm } from "../order-form";

type Quote = {
  id: string; ref: string; created_at: Date; status: string; service: string; project_ref: string | null; name: string; email: string;
  phone: string | null; company: string | null; client_role: string; client_type: "pro" | "particulier"; description: string;
  date_wish: string | null; budget_range: string; location: string | null; admin_notes: string | null;
};

const STATUS = { nouveau: "Nouveau", en_cours: "En cours", devis_envoye: "Devis envoyé", accepte: "Accepté", refuse: "Refusé", archive: "Archivé" } as const;

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireAdmin();
  const { s } = await searchParams;
  const filter = s && s in STATUS ? s : null;
  const quotes = await query<Quote>(
    `SELECT * FROM quotes ${filter ? "WHERE status = $1" : ""} ORDER BY created_at DESC LIMIT 200`,
    filter ? [filter] : [],
  );

  return (
    <div>
      <h1 className="t-display text-3xl">Demandes de devis</h1>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filtrer par statut">
        <a href="/admin/demandes" className="chip" aria-current={!filter ? "page" : undefined}>Toutes</a>
        {Object.entries(STATUS).map(([k, v]) => <a key={k} href={`/admin/demandes?s=${k}`} className="chip" aria-current={filter === k ? "page" : undefined}>{v}</a>)}
      </nav>
      {quotes.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-muted)]">Aucune demande pour l'instant.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <details className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] open:border-[var(--color-muted)]">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <span className="t-mono text-xs text-[var(--color-muted)]">{q.ref}</span>
                  <span className="font-semibold">{q.name}</span>
                  <span className="text-sm text-[var(--color-muted)]">{q.service} · {q.budget_range}</span>
                  <span className="ml-auto chip !min-h-[28px] text-xs">{STATUS[q.status as keyof typeof STATUS] ?? q.status}</span>
                  <span className="text-xs text-[var(--color-muted)]">{new Date(q.created_at).toLocaleString("fr-FR")}</span>
                </summary>
                <div className="grid gap-6 border-t border-[var(--color-line)] p-4 lg:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <p><a className="underline" href={`mailto:${q.email}?subject=${encodeURIComponent(`Votre demande ${q.ref}`)}`}>{q.email}</a>{q.phone ? ` · ${q.phone}` : ""}</p>
                    <p className="text-[var(--color-muted)]">{q.client_role}{q.company ? `, ${q.company}` : ""} · {q.client_type === "pro" ? "professionnel" : "particulier"}</p>
                    <p className="text-[var(--color-muted)]">Date : {q.date_wish ?? "-"} · Lieu : {q.location ?? "-"} · Réf. : {q.project_ref ?? "-"}</p>
                    <p className="whitespace-pre-wrap rounded-xl bg-[var(--color-ink)] p-3">{q.description}</p>
                    <form action={updateQuote} className="grid gap-2 pt-2">
                      <input type="hidden" name="id" value={q.id} />
                      <label className="text-xs font-semibold">Statut
                        <select name="status" defaultValue={q.status} className="input mt-1">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      </label>
                      <label className="text-xs font-semibold">Notes internes
                        <textarea name="notes" defaultValue={q.admin_notes ?? ""} rows={2} className="input mt-1" />
                      </label>
                      <button type="submit" className="btn btn-ghost justify-self-start">Enregistrer</button>
                    </form>
                  </div>
                  <div>
                    <p className="t-eyebrow mb-2">Créer la commande et le lien de paiement</p>
                    <OrderForm quote={{ id: q.id, name: q.name, email: q.email, clientType: q.client_type, label: `${q.service}${q.project_ref ? ` · ${q.project_ref}` : ""}` }} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
