import Link from "next/link";
import { BubbleRow } from "@/components/bubbles";
import { CtaLink } from "@/components/cta-link";
import { ProjectGrid } from "@/components/project-grid";
import { VideoSources } from "@/components/video-sources";
import { getArtists, getFeed, getProjects, getServices, site } from "@/lib/content";

/**
 * Accueil = profil de créateur. Le visiteur reconnaît instantanément la
 * structure (en-tête, actions, "stories", grille) : il n'a rien à apprendre
 * et peut se concentrer sur le travail. Les chiffres affichés sont calculés
 * à partir du contenu publié, jamais saisis à la main.
 */
export default function Home() {
  const projects = getProjects();
  const artists = getArtists().filter((a) => a.portrait);
  const feed = getFeed();
  const reel = feed.find((f) => f.video.height > f.video.width) ?? feed[0];
  const lavar = site.stats.filter((s) => s.label.includes("La Var"));

  return (
    <div className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-24">
      {/* ---------- En-tête du profil ---------- */}
      <section className="grid items-end gap-8 md:grid-cols-[1fr_auto]" aria-labelledby="nom">
        <div className="rise">
          <p className="t-eyebrow">Réalisation · Photo · Montage · DA</p>
          <h1 id="nom" className="t-display mt-3 text-[clamp(44px,9vw,112px)]">
            Sébastien
            <br />
            Fula-Pitu<span className="text-[var(--color-accent)]">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[#d9d5cc]">{site.baseline}</p>

          <dl className="mt-6 flex gap-6 sm:gap-10">
            <Stat value={projects.length} label="projets" />
            <Stat value={getArtists().length} label="artistes & médias" />
            <Stat value={feed.length} label="vidéos dans le flux" />
          </dl>

          <div className="mt-7 flex flex-wrap gap-2">
            <CtaLink href="/devis" cta="devis" surface="home_header" className="btn btn-primary">
              Demander un devis
            </CtaLink>
            <Link href="/flux" className="btn btn-ghost">
              <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
              Entrer dans le flux
            </Link>
            <Link href="/contact" className="btn btn-ghost">Contact</Link>
          </div>
        </div>

        {reel && (
          <Link
            href={`/flux?p=${reel.project.slug}`}
            className="group relative mx-auto hidden w-[240px] rotate-[2.5deg] overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10 transition-transform duration-500 hover:rotate-0 md:block lg:w-[280px]"
            aria-label={`Voir ${reel.project.title} dans le flux`}
          >
            <video
              poster={reel.video.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
              className="aspect-[9/16] w-full object-cover"
            >
              <VideoSources video={reel.video} />
            </video>
            <span className="glass absolute inset-x-3 bottom-3 rounded-2xl px-3 py-2 text-sm">
              <span className="t-eyebrow block !text-[10px]">Dans le flux</span>
              {reel.project.title}
            </span>
          </Link>
        )}
      </section>

      {/* ---------- Stories : les artistes ---------- */}
      <section className="mt-12" aria-labelledby="h-artistes">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="h-artistes" className="t-eyebrow">Avec qui</h2>
          <Link href="/artistes" className="text-sm text-[var(--color-muted)] underline-offset-4 hover:underline">
            Tout l'univers →
          </Link>
        </div>
        <BubbleRow artists={artists} surface="home" />
      </section>

      {/* ---------- Grille ---------- */}
      <section className="mt-10" aria-labelledby="h-travaux">
        <h2 id="h-travaux" className="sr-only">Travaux</h2>
        <ProjectGrid projects={projects} surface="home_grid" />
      </section>

      {/* ---------- La Var, chiffres datés et sourcés ---------- */}
      {lavar.length > 0 && (
        <section className="mt-16 rounded-[28px] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-10" aria-labelledby="h-lavar">
          <p className="t-eyebrow">Média</p>
          <h2 id="h-lavar" className="t-display mt-2 text-3xl sm:text-4xl">La Var, un média qui devient un système.</h2>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {site.stats.slice(0, 3).map((s) => (
              <div key={s.label} className="rounded-2xl bg-[var(--color-ink)] p-4">
                <dt className="text-sm text-[var(--color-muted)]">{s.label}</dt>
                <dd className="t-display mt-1 text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Source : {lavar[0].source}, au {new Date(lavar[0].asOf).toLocaleDateString("fr-FR")}.
          </p>
          <Link href="/projets/la-var" className="btn btn-ghost mt-5">Voir La Var</Link>
        </section>
      )}

      {/* ---------- Prestations ---------- */}
      <section className="mt-16" aria-labelledby="h-presta">
        <p className="t-eyebrow">Travailler ensemble</p>
        <h2 id="h-presta" className="t-display mt-2 text-3xl sm:text-5xl">Un clip, un shooting, une direction.</h2>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {getServices().map((s) => (
            <li key={s.slug}>
              <Link href={`/prestations#${s.slug}`} className="block h-full rounded-2xl border border-[var(--color-line)] p-5 transition-colors hover:border-[var(--color-fg)]">
                <p className="t-display text-xl">{s.title}</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{s.pitch}</p>
              </Link>
            </li>
          ))}
        </ul>
        <CtaLink href="/devis" cta="devis" surface="home_services" className="btn btn-primary mt-6">
          Décrire mon projet
        </CtaLink>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="t-display block text-2xl sm:text-3xl">{value}</span>
        <span className="text-sm text-[var(--color-muted)]" aria-hidden>{label}</span>
      </dd>
    </div>
  );
}
