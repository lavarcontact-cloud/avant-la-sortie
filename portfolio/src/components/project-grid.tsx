"use client";

import { useMemo, useState } from "react";
import { PROJECT_TYPE_LABEL, type Project } from "@/lib/content";
import { ProjectCard } from "./project-card";

const FILTERS: { key: string; label: string; match: (p: Project) => boolean }[] = [
  { key: "tout", label: "Tout", match: () => true },
  { key: "clip", label: "Clips", match: (p) => p.type === "clip" || p.type === "making-of" },
  { key: "photo", label: "Photo", match: (p) => p.type === "photo" },
  { key: "da", label: "Direction artistique", match: (p) => p.type === "direction-artistique" || p.type === "developpement-artiste" },
  { key: "media", label: "Média & événements", match: (p) => p.type === "media" || p.type === "evenement" },
];

export function ProjectGrid({ projects, surface }: { projects: Project[]; surface: string }) {
  const [filter, setFilter] = useState("tout");
  const shown = useMemo(() => projects.filter(FILTERS.find((f) => f.key === filter)!.match), [projects, filter]);

  return (
    <div>
      <div role="group" aria-label="Filtrer les travaux" className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className="chip shrink-0" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{shown.length} projets affichés</p>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-8 text-center text-[var(--color-muted)]">
          Aucun projet dans cette catégorie pour l'instant.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {shown.map((p, i) => (
            // Les 4 premières vignettes (visibles d'emblée) s'affichent sans animation d'entrée : elles portent le LCP.
            <li key={p.slug} className={i < 4 ? undefined : "rise"} style={{ ["--i" as string]: Math.min(i, 8) }}>
              <ProjectCard project={p} surface={surface} eager={i < 4} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { PROJECT_TYPE_LABEL };
