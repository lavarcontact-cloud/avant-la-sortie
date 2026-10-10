import type { Metadata } from "next";
import { ProjectGrid } from "@/components/project-grid";
import { getProjects } from "@/lib/content";

export const metadata: Metadata = {
  title: "Travaux",
  description: "Clips, photographie, direction artistique, making-of et média : tous les projets.",
  alternates: { canonical: "/projets" },
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
      <p className="t-eyebrow">Index</p>
      <h1 className="t-display mt-2 mb-8 text-[clamp(40px,7vw,84px)]">Travaux</h1>
      <ProjectGrid projects={getProjects()} surface="index" />
    </div>
  );
}
