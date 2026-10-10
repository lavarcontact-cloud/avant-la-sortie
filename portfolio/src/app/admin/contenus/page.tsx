import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { getReviewQueue, getProjects } from "@/lib/content";

/**
 * Registre de vérification : ce qui doit être confirmé avant une mise en
 * ligne publique (rôles, paternité des photos, autorisations de diffusion).
 * Le contenu se modifie dans /content/*.json (voir docs/README).
 */
export default async function ContentReview() {
  await requireAdmin();
  const q = getReviewQueue();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-display text-3xl">Contenus à vérifier</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{getProjects().length} projets publiés · {q.projects.length} avec une vérification ou une autorisation en attente · {q.artists.length} fiches artistes à confirmer.</p>
      </div>
      <section>
        <h2 className="t-eyebrow mb-3">Projets</h2>
        <ul className="space-y-2">
          {q.projects.map((p) => (
            <li key={p.slug} className="rounded-2xl border border-[var(--color-line)] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/projets/${p.slug}`} className="font-semibold underline">{p.title}</Link>
                <span className={`chip !min-h-[26px] text-xs ${p.verification.status === "verifie" ? "" : "!border-[var(--color-warn)] text-[var(--color-warn)]"}`}>{p.verification.status === "verifie" ? "Faits vérifiés" : "Faits à vérifier"}</span>
                <span className={`chip !min-h-[26px] text-xs ${p.rights.status === "autorise" ? "" : "!border-[var(--color-warn)] text-[var(--color-warn)]"}`}>{p.rights.status === "autorise" ? "Droits OK" : "Droits à confirmer"}</span>
              </div>
              {p.verification.note && <p className="mt-2 text-[var(--color-muted)]">Faits : {p.verification.note}</p>}
              {p.rights.note && p.rights.status !== "autorise" && <p className="mt-1 text-[var(--color-muted)]">Droits : {p.rights.note}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="t-eyebrow mb-3">Artistes</h2>
        <ul className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] text-sm">
          {q.artists.map((a) => <li key={a.slug} className="p-3"><b>{a.name}</b> · {a.relation}</li>)}
        </ul>
      </section>
    </div>
  );
}
