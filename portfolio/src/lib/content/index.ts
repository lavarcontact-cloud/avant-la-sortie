import { z } from "zod";
import artistsJson from "../../../content/artists.json";
import projectsJson from "../../../content/projects.json";
import servicesJson from "../../../content/services.json";
import siteJson from "../../../content/site.json";
import { artist, project, service, site as siteSchema } from "./schema";
import type { Artist, Project, Service, Site, VideoMedia } from "./schema";

export type { Artist, Project, Service, Site, VideoMedia };
export type { Media } from "./schema";

/**
 * Charge et valide le contenu une seule fois par processus. Une erreur ici
 * fait échouer le build : c'est voulu.
 */
function load() {
  const artists = z.array(artist).parse(artistsJson);
  const projects = z.array(project).parse(projectsJson);
  const services = z.array(service).parse(servicesJson);
  const site = siteSchema.parse(siteJson);

  const artistSlugs = new Set(artists.map((a) => a.slug));
  const projectSlugs = new Set(projects.map((p) => p.slug));
  const problems: string[] = [];
  if (artistSlugs.size !== artists.length) problems.push("slug d'artiste dupliqué");
  if (projectSlugs.size !== projects.length) problems.push("slug de projet dupliqué");
  for (const p of projects) {
    for (const a of p.artists)
      if (!artistSlugs.has(a)) problems.push(`projet ${p.slug} : artiste inconnu ${a}`);
  }
  for (const s of services) {
    for (const r of s.relatedProjects)
      if (!projectSlugs.has(r)) problems.push(`prestation ${s.slug} : projet inconnu ${r}`);
  }
  if (problems.length) throw new Error("Contenu incohérent :\n" + problems.join("\n"));

  return { artists, projects, services, site };
}

const content = load();

const byOrder = (a: Project, b: Project) => a.order - b.order;

export const site: Site = content.site;

export function getProjects(): Project[] {
  return content.projects.filter((p) => p.published).sort(byOrder);
}

export function getProject(slug: string): Project | undefined {
  return getProjects().find((p) => p.slug === slug);
}

export function getArtists(): Artist[] {
  return content.artists.filter((a) => a.published);
}

export function getArtist(slug: string): Artist | undefined {
  return getArtists().find((a) => a.slug === slug);
}

export function getProjectsForArtist(slug: string): Project[] {
  return getProjects().filter((p) => p.artists.includes(slug));
}

export function getArtistsForProject(p: Project): Artist[] {
  return p.artists.map((s) => getArtist(s)).filter((a): a is Artist => !!a);
}

export function getServices(): Service[] {
  return content.services.filter((s) => s.published);
}

export function getService(slug: string): Service | undefined {
  return getServices().find((s) => s.slug === slug);
}

/** Une entrée du flux vertical : une vidéo, rattachée à son projet. */
export type FeedItem = { project: Project; video: VideoMedia; artists: Artist[] };

export function getFeed(): FeedItem[] {
  const items: FeedItem[] = [];
  for (const p of getProjects().filter((x) => x.inFeed)) {
    const video = p.media.find((m): m is VideoMedia => m.kind === "video");
    if (video) items.push({ project: p, video, artists: getArtistsForProject(p) });
  }
  return items;
}

/** Toutes les photos publiées, pour la galerie. */
export function getPhotos() {
  return getProjects().flatMap((p) =>
    p.media
      .filter((m) => m.kind === "image" && !m.id.includes("synopsis"))
      .map((m) => ({ media: m, project: p })),
  );
}

/** Pour l'admin : tout ce qui reste à vérifier avant mise en ligne. */
export function getReviewQueue() {
  return {
    projects: content.projects.filter(
      (p) => p.verification.status !== "verifie" || p.rights.status !== "autorise",
    ),
    artists: content.artists.filter((a) => a.verification.status !== "verifie"),
  };
}

export const PROJECT_TYPE_LABEL: Record<Project["type"], string> = {
  clip: "Clip",
  photo: "Photo",
  "direction-artistique": "Direction artistique",
  "making-of": "Making-of",
  "developpement-artiste": "Développement d'artiste",
  media: "Média",
  evenement: "Événement",
};
