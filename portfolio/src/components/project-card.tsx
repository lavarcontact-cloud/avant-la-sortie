"use client";

import Image from "next/image";
import Link from "next/link";
import { ViewTransition, useRef } from "react";
import { track } from "@/lib/analytics/client";
import { PROJECT_TYPE_LABEL, type Project, type VideoMedia } from "@/lib/content";
import { VideoSources } from "./video-sources";

/**
 * Vignette de projet. Sur un appareil à pointeur fin, survoler une vignette
 * vidéo lance un aperçu muet : on voit le mouvement avant de cliquer. Rien
 * n'est téléchargé tant qu'on ne survole pas (preload="none").
 */
export function ProjectCard({ project, surface, sizes, eager }: { project: Project; surface: string; sizes?: string; eager?: boolean }) {
  const video = project.media.find((m): m is VideoMedia => m.kind === "video");
  const ref = useRef<HTMLVideoElement>(null);
  const canHover = () => typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;

  const start = () => {
    if (!video || !canHover()) return;
    ref.current?.play().catch(() => {});
  };
  const stop = () => {
    if (!ref.current) return;
    ref.current.pause();
  };

  return (
    <Link
      href={`/projets/${project.slug}`}
      onClick={() => track("project_open", { project: project.slug, surface })}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      className="group relative block overflow-hidden rounded-[18px] bg-[var(--color-panel)]"
    >
      <ViewTransition name={`project-${project.slug}`} share="morph" default="none">
        <div className="relative aspect-[4/5]">
          <Image
            src={project.cover}
            alt=""
            fill
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            sizes={sizes ?? "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
          />
          {video && (
            <video
              ref={ref}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden
              tabIndex={-1}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <VideoSources video={video} />
            </video>
          )}
        </div>
      </ViewTransition>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <p className="t-eyebrow line-clamp-1 !text-[10px] !text-white/70">
          {project.roles[0] && project.roles[0] !== PROJECT_TYPE_LABEL[project.type] ? project.roles[0] : PROJECT_TYPE_LABEL[project.type]}
        </p>
        <p className="t-display mt-1 text-[17px] leading-tight sm:text-xl">{project.title}</p>
      </div>
      {video && (
        <span aria-label="Contient une vidéo" className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur">
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><path d="M3 1.5v9l7.5-4.5z" fill="white" /></svg>
        </span>
      )}
    </Link>
  );
}
