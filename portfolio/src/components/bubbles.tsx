"use client";

import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { track } from "@/lib/analytics/client";
import type { Artist } from "@/lib/content";

type Surface = "home" | "constellation" | "feed" | "project";

function initials(name: string) {
  return name
    .split(/[\s']+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Le portrait vu à travers une lentille. Réutilisé partout où un artiste apparaît. */
export function Lens({ artist, size, priority, morph = true }: { artist: Artist; size: number; priority?: boolean; morph?: boolean }) {
  const lens = (
      <span className="lens block" style={{ width: size, height: size, ["--tint" as string]: artist.tint, ["--lens-size" as string]: `${size}px` }}>
        {artist.portrait ? (
          <Image src={artist.portrait} alt="" width={size * 2} height={size * 2} sizes={`${size}px`} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} />
        ) : (
          <span className="t-display flex h-full w-full items-center justify-center text-[color:var(--color-fg)]" style={{ fontSize: size * 0.32 }}>
            {initials(artist.name)}
          </span>
        )}
      </span>
  );
  // Nom de transition unique par page : désactivable là où un artiste
  // peut apparaître plusieurs fois (flux).
  return morph ? (
    <ViewTransition name={`artist-${artist.slug}`} share="morph" default="none">
      {lens}
    </ViewTransition>
  ) : (
    lens
  );
}

export function ArtistBubble({ artist, size = 72, surface, ring = true }: { artist: Artist; size?: number; surface: Surface; ring?: boolean }) {
  return (
    <Link
      href={`/artistes/${artist.slug}`}
      onClick={() => track("artist_bubble_click", { artist: artist.slug, surface })}
      className="group flex w-[88px] shrink-0 flex-col items-center gap-2 text-center"
    >
      <span className={ring ? "lens-ring transition-transform duration-300 group-hover:scale-105 group-active:scale-95" : ""}>
        <span className="block rounded-full bg-[var(--color-ink)] p-[2px]">
          <Lens artist={artist} size={size} />
        </span>
      </span>
      <span className="line-clamp-1 text-[12.5px] font-medium">{artist.name}</span>
    </Link>
  );
}

/** Rangée façon "stories" : défilement horizontal, accrochage doux. */
export function BubbleRow({ artists, surface }: { artists: Artist[]; surface: Surface }) {
  return (
    <ul className="-mx-5 flex snap-x snap-mandatory gap-1 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8" aria-label="Artistes">
      {artists.map((a) => (
        <li key={a.slug} className="snap-start">
          <ArtistBubble artist={a} surface={surface} />
        </li>
      ))}
    </ul>
  );
}
