import type { Metadata } from "next";
import { Gallery } from "@/components/gallery";
import { getArtistsForProject, getPhotos } from "@/lib/content";

export const metadata: Metadata = {
  title: "Photographie",
  description: "Portraits, photos de plateau, photos presse et pochettes.",
  alternates: { canonical: "/photo" },
};

export default function PhotoPage() {
  const seen = new Set<string>();
  const items = getPhotos()
    .filter(({ media }) => (seen.has(media.id) ? false : (seen.add(media.id), true)))
    .map(({ media, project }) => ({
      media,
      label: media.caption ?? getArtistsForProject(project).map((a) => a.name).join(", "),
    }));

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
      <p className="t-eyebrow">Planche-contact</p>
      <h1 className="t-display mt-2 mb-8 text-[clamp(40px,7vw,84px)]">Photographie</h1>
      <Gallery items={items} />
    </div>
  );
}
