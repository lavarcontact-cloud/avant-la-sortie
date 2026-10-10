"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import type { Media } from "@/lib/content";
import { VideoSources } from "./video-sources";

/**
 * Galerie + visionneuse. La visionneuse est un <dialog> natif : piège de
 * focus, Échap et retour du focus gérés par le navigateur. Flèches gauche
 * et droite pour naviguer, balayage horizontal sur mobile.
 */
export function Gallery({
  items,
  projectSlug,
  layout = "masonry",
}: {
  items: { media: Media; label?: string }[];
  projectSlug?: string;
  layout?: "masonry" | "row";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const step = (delta: number) => setOpen((o) => (o === null ? o : (o + delta + items.length) % items.length));

  const show = (i: number) => {
    setOpen(i);
    track("photo_open", { photo: items[i].media.id });
  };

  const current = open !== null ? items[open] : null;

  return (
    <>
      <ul className={layout === "masonry" ? "columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 [&>li]:mb-2 sm:[&>li]:mb-3" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"}>
        {items.map(({ media, label }, i) => (
          <li key={media.id + i} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => show(i)}
              className="group relative block w-full overflow-hidden rounded-[14px] bg-[var(--color-panel)] text-left"
              aria-label={`Agrandir : ${media.alt}`}
            >
              {media.kind === "image" ? (
                <Image
                  src={media.src}
                  alt={media.alt}
                  width={media.width}
                  height={media.height}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <span className="relative block">
                  <Image src={media.poster} alt={media.alt} width={media.width} height={media.height} sizes="(min-width: 640px) 33vw, 50vw" className="h-auto w-full" />
                  <span className="glass absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
                    <svg width="16" height="16" viewBox="0 0 12 12" aria-hidden><path d="M3.5 1.8v8.4l7-4.2z" fill="white" /></svg>
                  </span>
                </span>
              )}
              {(label ?? media.caption) && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-xs font-medium">{label ?? media.caption}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90 backdrop:backdrop-blur-sm"
        aria-label="Visionneuse"
      >
        {current && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="t-mono text-white/70">{(open ?? 0) + 1} / {items.length}</span>
              <button type="button" onClick={() => setOpen(null)} className="glass flex h-11 w-11 items-center justify-center rounded-full" aria-label="Fermer" autoFocus>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="white" strokeWidth="1.8" /></svg>
              </button>
            </div>
            <figure className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 sm:px-16">
              {current.media.kind === "image" ? (
                <Image src={current.media.src} alt={current.media.alt} width={current.media.width} height={current.media.height} sizes="100vw" className="max-h-full w-auto rounded-lg object-contain" />
              ) : (
                <video
                  key={current.media.id}
                  poster={current.media.poster}
                  controls
                  autoPlay
                  muted
                  playsInline
                  onPlay={() => projectSlug && track("video_start", { project: projectSlug, video: current.media.id, surface: "project" }, { once: `p-${current.media.id}` })}
                  onEnded={() => projectSlug && track("video_complete", { project: projectSlug, video: current.media.id })}
                  className="max-h-full w-auto rounded-lg"
                  aria-label={current.media.alt}
                >
                  <VideoSources video={current.media} />
                </video>
              )}
              <figcaption className="mt-3 px-4 text-center text-sm text-white/80">{current.label ?? current.media.caption ?? current.media.alt}</figcaption>
            </figure>
            {items.length > 1 && (
              <div className="flex justify-center gap-3 p-4 pb-8">
                <button type="button" onClick={() => step(-1)} className="glass btn" aria-label="Précédent">←</button>
                <button type="button" onClick={() => step(1)} className="glass btn" aria-label="Suivant">→</button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
