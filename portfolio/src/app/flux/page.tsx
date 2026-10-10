import type { Metadata } from "next";
import { Suspense } from "react";
import { preload } from "react-dom";
import { getFeed } from "@/lib/content";
import { Feed } from "./feed";

export const metadata: Metadata = {
  title: "Flux",
  description: "Les réalisations en plein écran, une après l'autre : clips, making-of, développement d'artiste.",
  alternates: { canonical: "/flux" },
};

export default function FluxPage() {
  const items = getFeed();
  // L'affiche de la première vidéo est l'élément le plus grand de l'écran : préchargée en priorité.
  const start = items[0];
  if (start) preload(start.video.poster, { as: "image", fetchPriority: "high" });
  return (
    <>
      <h1 className="sr-only">Flux de réalisations</h1>
      <Suspense>
        <Feed items={items} />
      </Suspense>
    </>
  );
}
