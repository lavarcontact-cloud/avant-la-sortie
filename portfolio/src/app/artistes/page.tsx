import type { Metadata } from "next";
import { getArtists, getProjectsForArtist, type Project } from "@/lib/content";
import { Constellation, type Node } from "./constellation";

export const metadata: Metadata = {
  title: "Artistes",
  description: "L'univers des artistes avec qui Sébastien Fula-Pitu a travaillé : clips, photos, direction artistique.",
  alternates: { canonical: "/artistes" },
};

function disciplinesOf(projects: Project[]) {
  const d = new Set<string>();
  for (const p of projects) {
    if (p.type === "clip" || p.type === "making-of") d.add("clip");
    if (p.type === "photo" || p.slug === "covers") d.add("photo");
    if (p.type === "direction-artistique" || p.type === "developpement-artiste") d.add("da");
    if (p.type === "media" || p.type === "evenement") d.add("media");
  }
  return [...d];
}

export default function ArtistsPage() {
  const nodes: Node[] = getArtists().map((artist) => {
    const projects = getProjectsForArtist(artist.slug);
    return { artist, weight: projects.length, disciplines: disciplinesOf(projects) };
  });

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
      <p className="t-eyebrow">Univers</p>
      <h1 className="t-display mt-2 text-[clamp(40px,7vw,84px)]">Artistes</h1>
      <p className="mt-3 max-w-xl text-[#d9d5cc]">
        Chaque bulle ouvre la relation réelle avec l'artiste : ce qui a été fait, et les images. Plus une bulle est grande, plus il y a de projets derrière.
      </p>
      <div className="mt-8">
        <Constellation nodes={nodes} />
      </div>
    </div>
  );
}
