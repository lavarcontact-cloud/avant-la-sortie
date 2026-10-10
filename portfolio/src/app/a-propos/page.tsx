import type { Metadata } from "next";
import Image from "next/image";
import { CtaLink } from "@/components/cta-link";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "À propos",
  description: site.bio[0],
  alternates: { canonical: "/a-propos" },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    jobTitle: "Réalisateur, photographe, monteur",
    knowsAbout: site.disciplines,
    email: `mailto:${site.contact.email}`,
  };
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="t-eyebrow">À propos</p>
      <h1 className="t-display mt-2 max-w-4xl text-[clamp(36px,6vw,76px)]">{site.bio[0]}</h1>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 text-lg text-[#d9d5cc]">
          {site.bio.slice(1).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <figure className="relative overflow-hidden rounded-[22px]">
          <Image src="/media/photos/origins-millau.jpg" alt="Vue aérienne de Millau, Aveyron" width={1100} height={570} className="h-auto w-full" />
          <figcaption className="glass absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs">Millau, Aveyron. Ville natale.</figcaption>
        </figure>
      </div>

      <section className="mt-16" aria-labelledby="h-parcours">
        <h2 id="h-parcours" className="t-eyebrow mb-6">Parcours</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {site.timeline.map((t, i) => (
            <li key={i} className="rounded-2xl border border-[var(--color-line)] p-5">
              <p className="t-mono text-sm text-[var(--color-accent)]">{t.year}</p>
              <p className="t-display mt-2 text-xl">{t.title}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{t.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-8 sm:grid-cols-2" aria-label="Compétences">
        <div>
          <h2 className="t-eyebrow mb-3">Disciplines</h2>
          <ul className="flex flex-wrap gap-2">{site.disciplines.map((d) => <li key={d} className="chip">{d}</li>)}</ul>
        </div>
        <div>
          <h2 className="t-eyebrow mb-3">Outils</h2>
          <ul className="flex flex-wrap gap-2">{site.tools.map((d) => <li key={d} className="chip">{d}</li>)}</ul>
        </div>
      </section>

      <div className="mt-16 flex flex-wrap gap-2">
        <CtaLink href="/devis" cta="devis" surface="about" className="btn btn-primary">Demander un devis</CtaLink>
        <CtaLink href={`mailto:${site.contact.email}`} cta="contact_email" surface="about" className="btn btn-ghost">{site.contact.email}</CtaLink>
      </div>
    </div>
  );
}
