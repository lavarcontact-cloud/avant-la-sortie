import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lens } from "@/components/bubbles";
import { CtaLink } from "@/components/cta-link";
import { ProjectCard } from "@/components/project-card";
import { getArtist, getArtists, getProjectsForArtist } from "@/lib/content";

export function generateStaticParams() {
  return getArtists().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArtist(slug);
  if (!a) return {};
  return {
    title: a.name,
    description: a.relation,
    alternates: { canonical: `/artistes/${a.slug}` },
    openGraph: a.portrait ? { images: [{ url: a.portrait }] } : undefined,
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = getArtist(slug);
  if (!artist) notFound();
  const projects = getProjectsForArtist(slug);
  const others = getArtists().filter((a) => a.slug !== slug && a.portrait);
  const i = others.findIndex((a) => a.name > artist.name);
  const next = others[i === -1 ? 0 : i];

  return (
    <div className="relative overflow-hidden">
      {/* Halo teinté par la photo : la page prend la couleur de l'artiste. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[640px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(closest-side, ${artist.tint}, transparent)` }}
      />
      <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-24 sm:px-8 sm:pt-28">
        <Link href="/artistes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Tous les artistes</Link>

        <header className="mt-6 flex flex-col items-center text-center sm:flex-row sm:items-end sm:gap-8 sm:text-left">
          <Lens artist={artist} size={168} priority />
          <div className="mt-5 sm:mt-0">
            <p className="t-eyebrow">Artiste</p>
            <h1 className="t-display mt-1 text-[clamp(44px,8vw,96px)]">{artist.name}</h1>
            <p className="mt-2 max-w-xl text-lg text-[#d9d5cc]">{artist.relation}</p>
            {artist.links.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {artist.links.map((l) => (
                  <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="chip">{l.label} ↗</a></li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <section className="mt-12" aria-labelledby="h-proj">
          <h2 id="h-proj" className="t-eyebrow mb-4">{projects.length} projet{projects.length > 1 ? "s" : ""}</h2>
          {projects.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {projects.map((p) => (
                <li key={p.slug}><ProjectCard project={p} surface="artist" /></li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--color-muted)]">Projets à venir.</p>
          )}
        </section>

        <section className="mt-14 flex flex-col gap-4 rounded-[28px] border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="t-display text-2xl">Un projet dans cet univers ?</p>
            <p className="mt-1 text-[var(--color-muted)]">Clip, photo, direction artistique : décrivez ce que vous avez en tête.</p>
          </div>
          <CtaLink href={`/devis?ref=artiste-${artist.slug}`} cta="devis" surface="artist" className="btn btn-primary">Demander un devis</CtaLink>
        </section>

        {next && (
          <Link href={`/artistes/${next.slug}`} className="group mt-8 flex items-center justify-end gap-3 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            <span>Artiste suivant : <b className="text-[var(--color-fg)]">{next.name}</b></span>
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
