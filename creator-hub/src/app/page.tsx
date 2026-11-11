import Link from "next/link";
import { getSetting, DEFAULT_PROFILE, type ProfileSettings } from "@/lib/settings";
import { getSectors } from "@/lib/data";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

const OFFERS = [
  { n: "01", t: "UGC", d: "Contenus courts, natifs et exploitables par la marque : hooks, démonstrations, usages réels. Droits d'usage définis au contrat." },
  { n: "02", t: "Gifting & tests produits", d: "Matériel testé en conditions réelles de tournage. Retour honnête, produit offert toujours mentionné." },
  { n: "03", t: "Influence", d: "Publication auprès de ma propre audience, clairement identifiée comme partenariat." },
  { n: "04", t: "Production photo & vidéo", d: "Du concept au livrable : réalisation, image, montage, étalonnage." },
  { n: "05", t: "Partenariats de marque", d: "Ambassadeur, collaborations récurrentes, calendriers éditoriaux construits ensemble." },
  { n: "06", t: "Activations musicales", d: "Relier les marques aux artistes, labels et projets musicaux : clips, sorties, événements." },
];

export default async function Home() {
  const [p, sectors] = await Promise.all([getSetting<ProfileSettings>("profile", DEFAULT_PROFILE), getSectors()]);
  const name = p.display_name || "Sébastien Fula-Pitu";
  const socials = [["Instagram", p.instagram], ["TikTok", p.tiktok], ["YouTube", p.youtube], ["LinkedIn", p.linkedin]].filter(([, v]) => v);
  const universes = sectors.filter((s) => !s.archived).map((s) => s.name);
  return (
    <main className="grain min-h-dvh overflow-x-hidden bg-ink text-paper">
      <header className="fixed inset-x-0 top-0 z-50 mix-blend-difference">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <span className="font-mono text-xs uppercase tracking-[0.2em]">{name}</span>
          <nav className="flex items-center gap-5 font-mono text-[0.7rem] uppercase tracking-[0.18em]">
            <a href="#offres" className="hidden sm:inline">Offres</a><Link href="/media-kit">Media Kit</Link><a href="#contact" className="text-accent">Collaborer</a>
          </nav>
        </div>
      </header>

      <section className="relative flex min-h-dvh flex-col justify-end px-5 pb-14 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,rgba(255,91,60,.22),transparent_70%),radial-gradient(40%_40%_at_10%_90%,rgba(246,243,236,.06),transparent_70%)]" />
        <div className="relative mx-auto w-full max-w-7xl">
          <p className="rise font-mono text-xs uppercase tracking-[0.25em] text-accent">{p.headline || "Créateur de contenu · Réalisateur · Photographe"}</p>
          <h1 className="rise mt-6 font-display text-[clamp(3rem,11vw,10rem)] font-extrabold leading-[0.88] tracking-[-0.04em]" style={{ animationDelay: ".1s" }}>
            Des images<br />qui travaillent<br /><span className="text-accent">pour les marques.</span>
          </h1>
          <div className="rise mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between" style={{ animationDelay: ".25s" }}>
            <p className="max-w-xl text-lg leading-relaxed text-paper/70">{p.bio || "UGC, production photo et vidéo, partenariats de marque et activations musicales — avec une exigence de cinéma et une transparence totale sur ce qui est sponsorisé."}</p>
            <a href="#contact" className="group inline-flex items-center gap-3 self-start rounded-full border border-paper/20 px-6 py-3.5 text-sm transition hover:border-accent hover:bg-accent">Travaillons ensemble <span className="transition group-hover:translate-x-1">→</span></a>
          </div>
        </div>
      </section>

      {universes.length > 0 && (
        <div className="border-y border-paper/10 py-5">
          <div className="flex w-max marquee gap-10 whitespace-nowrap font-display text-3xl font-semibold text-paper/80 sm:text-5xl">
            {[...universes, ...universes, ...universes, ...universes].map((u, i) => <span key={i} className="flex items-center gap-10">{u}<span className="text-accent">✦</span></span>)}
          </div>
        </div>
      )}

      <section id="offres" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <div className="mb-14 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">Offres</h2>
          <p className="max-w-md text-paper/60">Chaque type de collaboration a ses propres conditions, livrables, droits d'usage et rémunération. Rien n'est mélangé.</p>
        </div>
        <div className="grid border-t border-paper/10 md:grid-cols-2 lg:grid-cols-3">
          {OFFERS.map((o) => (
            <article key={o.n} className="group relative border-b border-paper/10 p-7 transition-colors hover:bg-paper/[0.03] md:border-r">
              <span className="font-mono text-xs text-accent">{o.n}</span>
              <h3 className="mt-6 font-display text-3xl font-semibold">{o.t}</h3>
              <p className="mt-3 leading-relaxed text-paper/60">{o.d}</p>
              <span className="absolute bottom-0 left-0 h-px w-0 bg-accent transition-all duration-500 group-hover:w-full" />
            </article>
          ))}
        </div>
      </section>

      {(p.stats.length > 0 || p.references.length > 0) && (
        <section className="mx-auto max-w-7xl px-5 pb-28 sm:px-8">
          {p.stats.length > 0 && (<>
            <h2 className="mb-10 font-mono text-xs uppercase tracking-[0.25em] text-paper/50">Chiffres vérifiés</h2>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-paper/10 lg:grid-cols-4">
              {p.stats.map((s, i) => <div key={i} className="bg-ink p-7"><div className="font-display text-5xl font-bold tabular">{s.value}</div><div className="mt-2 text-sm text-paper/70">{s.label}</div><div className="mt-3 font-mono text-[0.65rem] uppercase tracking-wider text-paper/35">{s.source}{s.date ? ` · ${s.date}` : ""}</div></div>)}
            </div>
          </>)}
          {p.references.length > 0 && (<div className="mt-20">
            <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-paper/50">Projets réalisés</h2>
            <ul className="divide-y divide-paper/10 border-y border-paper/10">
              {p.references.map((r, i) => (
                <li key={i} className="grid gap-2 py-6 sm:grid-cols-[1fr_2fr_auto] sm:items-baseline">
                  <span className="font-display text-2xl font-semibold">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-accent">{r.name} ↗</a> : r.name}</span>
                  <span className="text-paper/60">{r.detail}</span><span className="font-mono text-xs text-paper/40">{r.year}</span>
                </li>))}
            </ul>
          </div>)}
        </section>
      )}

      <section className="bg-paper text-ink">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <h2 className="font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl">Une façon de travailler claire.</h2>
          <ul className="space-y-5 text-lg">
            {["Contenus sponsorisés et produits reçus toujours signalés.", "Aucun chiffre gonflé, aucune promesse de viralité.", "Retours honnêtes sur les produits testés.", "Droits d'usage et livrables écrits avant de commencer.", "Pas de jeux d'argent, trading, crypto spéculative ni MLM."].map((x) => (
              <li key={x} className="flex gap-4 border-b border-ink/10 pb-5"><span className="text-accent">✦</span>{x}</li>))}
          </ul>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">Un projet&nbsp;?</h2>
            <p className="mt-5 max-w-sm text-paper/60">Décrivez votre besoin : je réponds personnellement avec une proposition adaptée.</p>
            {p.email && <a href={`mailto:${p.email}`} className="mt-8 block font-mono text-sm text-accent">{p.email}</a>}
            {socials.length > 0 && <div className="mt-6 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-wider text-paper/50">{socials.map(([l, v]) => <a key={l} href={v} target="_blank" rel="noreferrer" className="hover:text-paper">{l} ↗</a>)}</div>}
          </div>
          <ContactForm />
        </div>
      </section>

      <footer className="border-t border-paper/10 px-5 py-8 font-mono text-[0.68rem] uppercase tracking-wider text-paper/35 sm:px-8">
        <div className="mx-auto flex max-w-7xl justify-between"><span>© {new Date().getFullYear()} {name}</span><Link href="/media-kit">Media Kit</Link></div>
      </footer>
    </main>
  );
}
