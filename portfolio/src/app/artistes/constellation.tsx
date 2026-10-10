"use client";

import Link from "next/link";
import { useState } from "react";
import { ArtistBubble, Lens } from "@/components/bubbles";
import { track } from "@/lib/analytics/client";
import type { Artist } from "@/lib/content";

export type Node = { artist: Artist; weight: number; disciplines: string[] };

const DISCIPLINES = [
  { key: "all", label: "Tous" },
  { key: "clip", label: "Clips" },
  { key: "photo", label: "Photo" },
  { key: "da", label: "Direction artistique" },
  { key: "media", label: "Média" },
];

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * Constellation : spirale de Fibonacci (phyllotaxie). Les artistes avec le
 * plus de projets sont au centre et plus grands : la taille porte une
 * information, pas seulement de la décoration. Les filtres éteignent les
 * bulles non concernées au lieu de les retirer, pour garder la géographie.
 */
export function Constellation({ nodes }: { nodes: Node[] }) {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"orbit" | "list">("orbit");
  const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
  const maxW = Math.max(...sorted.map((n) => n.weight));
  const match = (n: Node) => filter === "all" || n.disciplines.includes(filter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrer par discipline" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {DISCIPLINES.map((d) => (
            <button key={d.key} type="button" className="chip shrink-0" aria-pressed={filter === d.key} onClick={() => setFilter(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Affichage" className="flex gap-1 rounded-full border border-[var(--color-line)] p-1">
          <button type="button" className="chip !min-h-[32px] !border-0" aria-pressed={view === "orbit"} onClick={() => setView("orbit")}>Univers</button>
          <button type="button" className="chip !min-h-[32px] !border-0" aria-pressed={view === "list"} onClick={() => setView("list")}>Liste</button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{sorted.filter(match).length} artistes correspondent</p>

      {view === "orbit" ? (
        <ul className="constellation relative mx-auto mt-6 h-[1100px] max-w-5xl sm:h-[900px] lg:h-[760px]" aria-label="Univers des artistes">
          {sorted.map((n, i) => {
            const r = Math.sqrt(i + 0.6) / Math.sqrt(sorted.length);
            const a = i * GOLDEN;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            const size = Math.round(64 + (n.weight / maxW) * 56);
            const on = match(n);
            return (
              <li
                key={n.artist.slug}
                data-dim={on ? undefined : ""}
                className="orbit-node"
                style={{ ["--x" as string]: x.toFixed(4), ["--y" as string]: y.toFixed(4) }}
              >
                <div className="drift" style={{ animationDelay: `${(i % 7) * -1.3}s`, animationDuration: `${9 + (i % 5)}s` }}>
                  <ArtistBubble artist={n.artist} size={size} surface="constellation" ring={n.weight > 1} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)]">
          {sorted.filter(match).map((n) => (
            <li key={n.artist.slug}>
              <Link
                href={`/artistes/${n.artist.slug}`}
                onClick={() => track("artist_bubble_click", { artist: n.artist.slug, surface: "constellation" })}
                className="flex items-center gap-4 p-3 hover:bg-[var(--color-panel)]"
              >
                <Lens artist={n.artist} size={48} />
                <span className="flex-1">
                  <span className="block font-semibold">{n.artist.name}</span>
                  <span className="block text-sm text-[var(--color-muted)]">{n.artist.relation}</span>
                </span>
                <span className="t-mono text-xs text-[var(--color-muted)]">{n.weight} projet{n.weight > 1 ? "s" : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
