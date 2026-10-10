"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import type { VideoMedia } from "@/lib/content";
import { VideoSources } from "./video-sources";

/** Vidéo d'en-tête de projet : lecture auto muette, sauf "mouvement réduit". */
export function HeroVideo({ video, projectSlug }: { video: VideoMedia; projectSlug: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.play().catch(() => {});
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <>
      <video
        ref={ref}
        poster={video.poster}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          track("video_start", { project: projectSlug, video: video.id, surface: "project" }, { once: `hero-${video.id}` });
        }}
        onPause={() => setPlaying(false)}
        aria-label={video.alt}
        className={`absolute inset-0 h-full w-full ${video.height > video.width ? "object-contain" : "object-cover"}`}
      >
        <VideoSources video={video} />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="glass absolute right-4 top-20 z-10 flex h-11 w-11 items-center justify-center rounded-full sm:right-8"
        aria-label={playing ? "Mettre en pause" : "Lire"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="white" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden><path d="M3.5 1.8v8.4l7-4.2z" fill="white" /></svg>
        )}
      </button>
    </>
  );
}
