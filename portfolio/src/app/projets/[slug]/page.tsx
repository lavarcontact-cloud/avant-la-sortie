import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { ArtistBubble } from "@/components/bubbles";
import { CtaLink } from "@/components/cta-link";
import { Gallery } from "@/components/gallery";
import { HeroVideo } from "@/components/hero-video";
import { PROJECT_TYPE_LABEL, getArtistsForProject, getProject, getProjects, getServices, site } from "@/lib/content";

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  const img = p.media.find((m) => m.kind === "image")?.src ?? p.cover;
  return {
    title: `${p.title}, ${getArtistsForProject(p).map((a) => a.name).join(", ")}`,
    description: p.summary,
    alternates: { canonical: `/projets/${p.slug}` },
    openGraph: { title: p.title, description: p.summary, images: [{ url: img }], type: "article" },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const artists = getArtistsForProject(project);
  const all = getProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  const next = all[(idx + 1) % all.length];
  const heroVideo = project.media.find((m) => m.kind === "video");
  const service = getServices().find((s) => s.relatedProjects.includes(project.slug));
  const gallery = project.media.filter((m) => m !== heroVideo).map((media) => ({ media }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": heroVideo ? "VideoObject" : "CreativeWork",
    name: project.title,
    description: project.summary,
    ...(heroVideo
      ? { thumbnailUrl: heroVideo.poster, contentUrl: heroVideo.src, duration: `PT${Math.round(heroVideo.durationSec)}S` }
      : { image: project.cover }),
    creator: { "@type": "Person", name: site.name },
  };

  return (
    <article className="pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="relative">
        <ViewTransition name={`project-${project.slug}`} share="morph" default="none">
          <div className="relative h-[72svh] min-h-[420px] w-full overflow-hidden bg-black sm:h-[82svh]">
            {heroVideo ? (
              <HeroVideo video={heroVideo} projectSlug={project.slug} />
            ) : (
              <Image src={project.cover} alt={project.media[0].alt} fill loading="eager" fetchPriority="high" sizes="100vw" className="object-cover" />
            )}
          </div>
        </ViewTransition>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-ink)] via-black/20 to-black/40" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <p className="t-eyebrow !text-white/80">{PROJECT_TYPE_LABEL[project.type]}{project.year ? ` · ${project.year}` : ""}</p>
          <h1 className="t-display mt-2 text-[clamp(40px,8vw,104px)]">{project.title}</h1>
          <p className="mt-2 text-lg font-medium">{artists.map((a) => a.name).join(", ")}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 sm:px-8 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-xl leading-relaxed text-[#ece8df]">{project.summary}</p>
          {project.body.map((para, i) => (
            <p key={i} className="mt-4 text-[#d9d5cc]">{para}</p>
          ))}

          {gallery.length > 0 && (
            <section className="mt-10" aria-labelledby="h-images">
              <h2 id="h-images" className="t-eyebrow mb-4">Images</h2>
              <Gallery items={gallery} projectSlug={project.slug} />
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {project.roles.length > 0 && (
            <div>
              <h2 className="t-eyebrow">Rôle</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {project.roles.map((r) => <li key={r} className="chip">{r}</li>)}
              </ul>
            </div>
          )}
          {project.credits.length > 0 && (
            <div>
              <h2 className="t-eyebrow">Crédits</h2>
              <dl className="mt-2 space-y-2 text-sm">
                {project.credits.map((c) => (
                  <div key={c.role + c.name} className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-2">
                    <dt className="text-[var(--color-muted)]">{c.role}</dt>
                    <dd className="text-right">{c.name}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div>
            <h2 className="t-eyebrow">Artistes</h2>
            <ul className="mt-3 flex flex-wrap gap-1">
              {artists.map((a) => <li key={a.slug}><ArtistBubble artist={a} size={56} surface="project" /></li>)}
            </ul>
          </div>
          {project.inFeed && (
            <Link href={`/flux?p=${project.slug}`} className="btn btn-ghost w-full">Voir dans le flux</Link>
          )}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <p className="t-display text-xl">Un projet dans cet esprit ?</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{service ? service.pitch : "Décrivez votre idée, Sébastien revient vers vous avec une proposition."}</p>
            <CtaLink href={`/devis?ref=${project.slug}${service ? `&service=${service.slug}` : ""}`} cta="devis" surface="project" className="btn btn-primary mt-4 w-full">
              Demander un devis
            </CtaLink>
          </div>
        </aside>
      </div>

      <nav aria-label="Projet suivant" className="mx-auto mt-16 max-w-6xl px-5 sm:px-8">
        <Link href={`/projets/${next.slug}`} className="group flex items-center justify-between rounded-2xl border border-[var(--color-line)] p-5 hover:border-[var(--color-fg)]">
          <span>
            <span className="t-eyebrow block">Suivant</span>
            <span className="t-display text-2xl sm:text-3xl">{next.title}</span>
          </span>
          <span className="text-2xl transition-transform group-hover:translate-x-1" aria-hidden>→</span>
        </Link>
      </nav>
    </article>
  );
}
