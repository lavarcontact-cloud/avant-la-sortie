import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/cta-link";
import { ProjectCard } from "@/components/project-card";
import { getProject, getServices } from "@/lib/content";
import { formatEurosPublic } from "@/lib/format";

export const metadata: Metadata = {
  title: "Prestations",
  description: "Réalisation de clip, photographie, direction artistique, contenus et making-of. Sur devis.",
  alternates: { canonical: "/prestations" },
};

const STEPS = [
  ["Brief", "Vous décrivez le projet via le formulaire de devis."],
  ["Proposition", "Un devis détaillé : intention, équipe, planning, prix."],
  ["Acompte", "Un lien de paiement sécurisé confirme la réservation."],
  ["Production", "Préparation, tournage ou shooting, montage."],
  ["Livraison", "Fichiers définitifs après règlement du solde."],
];

export default function ServicesPage() {
  const services = getServices();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
      <p className="t-eyebrow">Prestations</p>
      <h1 className="t-display mt-2 text-[clamp(40px,7vw,84px)]">Travailler ensemble</h1>
      <p className="mt-3 max-w-xl text-[#d9d5cc]">Artistes, managers, labels, marques, agences : chaque projet est chiffré sur devis, selon ce qu'il demande vraiment.</p>

      <div className="mt-12 space-y-16">
        {services.map((s) => {
          const related = s.relatedProjects.map(getProject).filter((p) => !!p).slice(0, 3);
          return (
            <section key={s.slug} id={s.slug} aria-labelledby={`h-${s.slug}`} className="scroll-mt-24 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
              <div>
                <h2 id={`h-${s.slug}`} className="t-display text-3xl sm:text-4xl">{s.title}</h2>
                <p className="mt-2 text-[#d9d5cc]">{s.pitch}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {s.deliverables.map((d) => <li key={d} className="flex gap-2"><span className="text-[var(--color-accent)]" aria-hidden>●</span>{d}</li>)}
                </ul>
                <p className="mt-4 text-sm text-[var(--color-muted)]">{s.priceFromCents ? `À partir de ${formatEurosPublic(s.priceFromCents)} TTC` : "Sur devis"} · acompte de {s.depositPercent} % à la commande</p>
                <CtaLink href={`/devis?service=${s.slug}`} cta="prestation" surface={`prestations_${s.slug}`} className="btn btn-primary mt-5">Demander un devis</CtaLink>
              </div>
              <ul className="grid grid-cols-3 gap-2">
                {related.map((p) => <li key={p!.slug}><ProjectCard project={p!} surface="services" sizes="(min-width:1024px) 18vw, 33vw" /></li>)}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-20" aria-labelledby="h-process">
        <h2 id="h-process" className="t-eyebrow mb-4">Comment ça se passe</h2>
        <ol className="grid gap-3 sm:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-[var(--color-line)] p-4">
              <p className="t-mono text-xs text-[var(--color-accent)]">{String(i + 1).padStart(2, "0")}</p>
              <p className="t-display mt-1 text-lg">{t}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-[var(--color-muted)]">Conditions : <Link className="underline" href="/cgv">CGV</Link>.</p>
      </section>
    </div>
  );
}
