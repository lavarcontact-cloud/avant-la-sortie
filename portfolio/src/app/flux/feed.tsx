"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lens } from "@/components/bubbles";
import { track } from "@/lib/analytics/client";
import type { FeedItem } from "@/lib/content";
import { VideoSources } from "@/components/video-sources";

/**
 * Flux vertical. Mécanique :
 * - défilement natif + scroll-snap (fluide, accessible, zéro dépendance) ;
 * - seule la vidéo visible à 60 % joue ; la suivante précharge ses
 *   métadonnées, les autres ne chargent rien ;
 * - "mouvement réduit" : rien ne démarre seul, un bouton lecture s'affiche ;
 * - clavier : flèches haut/bas, J/K, espace pour pause ;
 * - l'URL suit l'élément affiché (?p=slug) : un lien partagé ouvre sur la
 *   bonne vidéo.
 */
export function Feed({ items }: { items: FeedItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const startSlug = params.get("p");
  const startIndex = Math.max(0, items.findIndex((i) => i.project.slug === startSlug));
  const [active, setActive] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const prev = useRef(startIndex);

  useEffect(() => {
    setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = scroller.current?.children[startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setActive(Number((e.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] },
    );
    for (const c of Array.from(root.children)) io.observe(c);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const cur = items[active];
    if (prev.current !== active) {
      const from = items[prev.current];
      if (from && cur) track("feed_swipe", { from: from.project.slug, to: cur.project.slug, index: active });
      prev.current = active;
      setPaused(false);
    }
    if (!cur) return; // écran de fin
    const url = new URL(location.href);
    url.searchParams.set("p", cur.project.slug);
    history.replaceState(history.state, "", url);
  }, [active, items]);

  const go = useCallback((delta: number) => {
    const next = Math.min(items.length, Math.max(0, active + delta));
    (scroller.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ behavior: reduced ? "instant" as ScrollBehavior : "smooth" });
  }, [active, items.length, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); go(1); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); go(-1); }
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === "Escape") router.push("/");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go, router]);

  return (
    <div className="relative">
      <div ref={scroller} className="feed" aria-label="Flux de réalisations" role="feed" aria-busy="false">
        {items.map((item, i) => (
          <FeedSlide
            key={item.project.slug}
            item={item}
            index={i}
            total={items.length}
            isActive={i === active}
            isNear={Math.abs(i - active) <= 1}
            paused={paused || reduced}
            onTogglePause={() => { setReduced(false); setPaused((p) => !p); }}
          />
        ))}
        <EndSlide index={items.length} />
      </div>
      {/* Commandes desktop : le swipe n'existe pas à la souris. */}
      <div className="pointer-events-none fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <button type="button" onClick={() => go(-1)} disabled={active === 0} className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30" aria-label="Vidéo précédente">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 10l5-5 5 5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
        </button>
        <button type="button" onClick={() => go(1)} disabled={active === items.length} className="glass pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30" aria-label="Vidéo suivante">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
        </button>
      </div>
    </div>
  );
}

function FeedSlide({
  item,
  index,
  total,
  isActive,
  isNear,
  paused,
  onTogglePause,
}: {
  item: FeedItem;
  index: number;
  total: number;
  isActive: boolean;
  isNear: boolean;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const { project, video, artists } = item;
  const ref = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [tc, setTc] = useState("00:00:00");
  const [blocked, setBlocked] = useState(false);
  const marks = useRef(new Set<number>());
  const vertical = video.height > video.width;

  // Ajouter des <source> après coup impose un load() explicite.
  useEffect(() => {
    if (isNear) ref.current?.load();
  }, [isNear]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive && !paused) {
      v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    } else {
      v.pause();
    }
  }, [isActive, paused]);

  const onTime = () => {
    const v = ref.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    const f = Math.floor(v.currentTime * 25);
    setTc(`${String(Math.floor(f / 1500)).padStart(2, "0")}:${String(Math.floor(f / 25) % 60).padStart(2, "0")}:${String(f % 25).padStart(2, "0")}`);
    for (const m of [25, 50, 75] as const) {
      if (pct >= m && !marks.current.has(m)) {
        marks.current.add(m);
        track("video_progress", { project: project.slug, video: video.id, pct: m });
      }
    }
  };

  const share = async () => {
    const url = `${location.origin}/flux?p=${project.slug}`;
    if (navigator.share) {
      await navigator.share({ title: project.title, url }).catch(() => {});
      track("share", { project: project.slug, method: "native" });
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      track("share", { project: project.slug, method: "copy" });
    }
  };

  const showPlay = paused || blocked;

  return (
    <article
      className="feed-item bg-black"
      data-index={index}
      aria-posinset={index + 1}
      aria-setsize={total}
      aria-labelledby={`feed-title-${project.slug}`}
      aria-current={isActive ? "true" : undefined}
    >
      {/* Fond : l'affiche floutée remplit l'écran autour d'une vidéo dont le
          format ne correspond pas (16:9 sur mobile, 9:16 sur desktop). */}
      <div aria-hidden className="absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-2xl" style={{ backgroundImage: `url(${video.poster})` }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={ref}
          poster={video.poster}
          muted
          loop
          playsInline
          preload={isActive ? "auto" : isNear ? "metadata" : "none"}
          onTimeUpdate={onTime}
          onPlay={() => track("video_start", { project: project.slug, video: video.id, surface: "feed" }, { once: `feed-${video.id}` })}
          onEnded={() => track("video_complete", { project: project.slug, video: video.id })}
          onClick={onTogglePause}
          aria-label={video.alt}
          className={`relative max-h-full ${vertical ? "h-full w-auto md:h-[calc(100svh-120px)] md:rounded-[28px]" : "w-full md:w-auto md:max-w-[min(1100px,calc(100vw-220px))] md:rounded-[22px]"} object-contain`}
        >
          {/* Sources montées seulement à proximité : les vidéos lointaines ne chargent rien. */}
          {isNear && <VideoSources video={video} />}
        </video>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {showPlay && isActive && (
        <button type="button" onClick={onTogglePause} className="glass absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Lire la vidéo">
          <svg width="26" height="26" viewBox="0 0 12 12" aria-hidden><path d="M3.5 1.8v8.4l7-4.2z" fill="white" /></svg>
        </button>
      )}

      {/* Progression de lecture */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+60px)] h-[3px] overflow-hidden rounded-full bg-white/20 md:inset-x-auto md:left-1/2 md:w-[min(560px,60vw)] md:-translate-x-1/2" aria-hidden>
        <div className="h-full bg-white transition-[width] duration-200 ease-linear" style={{ width: `${isActive ? progress : 0}%` }} />
      </div>
      {/* Timecode réel du clip : le voyant corail ne s'allume que pendant la lecture. */}
      <p aria-hidden className="t-mono absolute right-4 top-[calc(env(safe-area-inset-top)+70px)] flex items-center gap-1.5 text-[11px] text-white/80 md:right-auto md:left-1/2 md:translate-x-[calc(min(560px,60vw)/2-100%)]">
        <span className={`h-1.5 w-1.5 rounded-full ${isActive && !showPlay ? "bg-[var(--color-accent)]" : "bg-white/40"}`} />
        {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")} · {isActive ? tc : "00:00:00"}
      </p>

      {/* Informations */}
      <div className="absolute bottom-[calc(var(--dock-h)+var(--safe-b)+28px)] left-4 right-24 md:left-8 md:max-w-md">
        <p className="t-eyebrow !text-white/70">{project.roles.join(" · ") || "Projet"}</p>
        <h2 id={`feed-title-${project.slug}`} className="t-display mt-2 text-3xl md:text-4xl">
          {project.title}
        </h2>
        <p className="mt-1 text-[15px] font-medium text-white/90">{artists.map((a) => a.name).join(", ")}</p>
        <p className="mt-2 line-clamp-2 text-sm text-white/75">{project.summary}</p>
        <Link
          href={`/projets/${project.slug}`}
          onClick={() => track("project_open", { project: project.slug, surface: "feed" })}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
        >
          Voir le projet →
        </Link>
      </div>

      {/* Rail d'actions : verre, car posé sur la vidéo */}
      <div className="absolute bottom-[calc(var(--dock-h)+var(--safe-b)+28px)] right-3 flex flex-col items-center gap-3 md:right-8">
        {artists.slice(0, 2).map((a) => (
          <Link
            key={a.slug}
            href={`/artistes/${a.slug}`}
            onClick={() => track("artist_bubble_click", { artist: a.slug, surface: "feed" })}
            className="flex flex-col items-center gap-1"
            aria-label={`Artiste : ${a.name}`}
          >
            <span className="lens-ring"><span className="block rounded-full bg-black p-[2px]"><Lens artist={a} size={44} morph={false} /></span></span>
          </Link>
        ))}
        <RailButton label="Partager" onClick={share}>
          <path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
        </RailButton>
        <Link
          href={`/devis?ref=${project.slug}`}
          onClick={() => track("cta_click", { cta: "devis", surface: "feed" })}
          className="flex flex-col items-center gap-1 text-[11px] font-semibold"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          </span>
          Devis
        </Link>
      </div>
    </article>
  );
}

/** "Fin de bobine" : le flux ne s'arrête pas dans le vide, il ouvre sur la suite. */
function EndSlide({ index }: { index: number }) {
  return (
    <article className="feed-item flex items-center justify-center bg-[var(--color-ink)] px-6" data-index={index} aria-label="Fin du flux">
      <div className="max-w-md text-center">
        <p className="t-mono text-xs text-[var(--color-muted)]">FIN DE BOBINE</p>
        <h2 className="t-display mt-4 text-4xl sm:text-5xl">La prochaine image, c'est la vôtre ?</h2>
        <p className="mt-3 text-[var(--color-muted)]">Clip, photo, direction artistique : décrivez le projet en une minute.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/devis?ref=flux" onClick={() => track("cta_click", { cta: "devis", surface: "feed_end" })} className="btn btn-primary">Demander un devis</Link>
          <Link href="/projets" className="btn btn-ghost">Tous les travaux</Link>
        </div>
      </div>
    </article>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 text-[11px] font-semibold">
      <span className="glass flex h-12 w-12 items-center justify-center rounded-full">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {children}
        </svg>
      </span>
      {label}
    </button>
  );
}
