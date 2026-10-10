import { z } from "zod";

/**
 * Modèle de contenu éditorial. Les fichiers JSON de /content sont validés
 * contre ces schémas au chargement (build) et dans les tests : un contenu
 * invalide casse le build au lieu de casser une page en production.
 *
 * Règle produit : aucune collaboration, rôle ou chiffre n'est publié sans
 * source. Chaque entrée porte un statut de vérification ; un rôle non
 * documenté reste vide plutôt que deviné.
 */

export const verification = z.object({
  status: z.enum(["verifie", "a-verifier"]),
  /** D'où vient l'information (ex. "site Avant la sortie, chapitre Image"). */
  source: z.string().min(1),
  note: z.string().optional(),
});

export const rights = z.object({
  /** Autorisation de diffusion des médias (artiste, label, production). */
  status: z.enum(["autorise", "a-confirmer"]),
  note: z.string().optional(),
});

const mediaBase = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  src: z.string().startsWith("/media/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(3),
  caption: z.string().optional(),
};

export const imageMedia = z.object({ kind: z.literal("image"), ...mediaBase });
export const videoMedia = z.object({
  kind: z.literal("video"),
  ...mediaBase,
  poster: z.string().startsWith("/media/"),
  durationSec: z.number().positive(),
  /** Les extraits sont muets : pas de piste son à sous-titrer. */
  hasAudio: z.boolean().default(false),
});
export const media = z.discriminatedUnion("kind", [imageMedia, videoMedia]);

export const projectType = z.enum([
  "clip",
  "photo",
  "direction-artistique",
  "making-of",
  "developpement-artiste",
  "media",
  "evenement",
]);

export const project = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  /** Titre du morceau / de l'œuvre entre guillemets droits, si applicable. */
  work: z.string().optional(),
  artists: z.array(z.string()).min(1),
  type: projectType,
  year: z.number().int().min(2015).max(2100).optional(),
  /** Rôles de Sébastien sur ce projet, uniquement s'ils sont documentés. */
  roles: z.array(z.string()).default([]),
  summary: z.string(),
  body: z.array(z.string()).default([]),
  cover: z.string(),
  media: z.array(media).min(1),
  credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
  inFeed: z.boolean().default(false),
  order: z.number().default(100),
  published: z.boolean().default(true),
  verification,
  rights,
});

export const artist = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** Lien réel avec Sébastien, formulé sans exagération. */
  relation: z.string(),
  portrait: z.string().optional(),
  /** Couleur de lueur de la bulle, tirée de la photo. */
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FF5B3C"),
  links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
  published: z.boolean().default(true),
  verification,
});

export const service = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  pitch: z.string(),
  deliverables: z.array(z.string()),
  /**
   * Prix public en centimes TTC. null = sur devis (cas par défaut tant que
   * les tarifs ne sont pas validés par Sébastien).
   */
  priceFromCents: z.number().int().positive().nullable(),
  /** Part d'acompte demandée à la commande, en %. */
  depositPercent: z.number().int().min(0).max(100),
  relatedProjects: z.array(z.string()).default([]),
  published: z.boolean().default(true),
});

export const site = z.object({
  name: z.string(),
  tagline: z.string(),
  baseline: z.string(),
  bio: z.array(z.string()),
  disciplines: z.array(z.string()),
  tools: z.array(z.string()),
  contact: z.object({
    email: z.email(),
    phone: z.string().optional(),
    phoneE164: z.string().optional(),
    city: z.string(),
  }),
  socials: z.array(z.object({ label: z.string(), url: z.url() })),
  timeline: z.array(
    z.object({ year: z.string(), title: z.string(), detail: z.string() }),
  ),
  stats: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      context: z.string(),
      asOf: z.string(),
      source: z.string(),
    }),
  ),
  /** Informations légales de l'éditeur : à compléter par Sébastien. */
  legal: z.object({
    publisherName: z.string(),
    status: z.string().nullable(),
    siret: z.string().nullable(),
    address: z.string().nullable(),
    vatNote: z.string().nullable(),
    host: z.object({ name: z.string(), address: z.string(), contact: z.string() }),
    mediator: z.string().nullable(),
  }),
});

export type Media = z.infer<typeof media>;
export type VideoMedia = z.infer<typeof videoMedia>;
export type Project = z.infer<typeof project>;
export type Artist = z.infer<typeof artist>;
export type Service = z.infer<typeof service>;
export type Site = z.infer<typeof site>;
