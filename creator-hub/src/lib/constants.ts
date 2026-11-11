// Référentiels métier. Les libellés sont en français, les clés stables en base.

export const COLLAB_TYPES = {
  ugc_paid: { label: "UGC rémunéré", short: "UGC", paid: true, hint: "La marque paie un contenu qu'elle exploite (droits d'usage à préciser)." },
  gifting: { label: "Gifting", short: "Gifting", paid: false, hint: "Produit offert, sans rémunération obligatoire. Jamais compté en chiffre d'affaires." },
  product_test: { label: "Test produit / matériel", short: "Test", paid: false, hint: "Test et retour honnête selon les conditions convenues." },
  influence: { label: "Influence (publication sur mes réseaux)", short: "Influence", paid: true, hint: "Publication auprès de ma propre audience, mention partenariat obligatoire." },
  ambassador: { label: "Ambassadeur / Brand Partner", short: "Ambassadeur", paid: true, hint: "Collaboration récurrente." },
  event: { label: "Événementiel / invitation", short: "Événement", paid: true, hint: "Invitation, couverture, activation." },
  production: { label: "Production photo / vidéo", short: "Production", paid: true, hint: "Prestation de production pour la marque." },
  music: { label: "Partenariat musical", short: "Musique", paid: true, hint: "Marques × artistes, labels, projets musicaux." },
  strategy: { label: "Stratégie / création / marketing", short: "Stratégie", paid: true, hint: "Prestation de conseil ou de création." },
} as const;
export type CollabType = keyof typeof COLLAB_TYPES;
export const COLLAB_KEYS = Object.keys(COLLAB_TYPES) as CollabType[];

export const SERVICE_CATEGORIES = [
  "UGC vidéo", "Pack UGC", "Photo", "Vidéo publicitaire", "Influence / publication", "Gifting",
  "Test produit", "Événementiel", "Ambassadeur de marque", "Production audiovisuelle",
  "Stratégie marketing", "Activation musicale", "Autre prestation",
] as const;

export const CHANNELS = {
  email: "Email",
  instagram: "DM Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  form: "Formulaire officiel",
  phone: "Téléphone",
  in_person: "En personne",
  other: "Autre",
} as const;
export type Channel = keyof typeof CHANNELS;

export const ROLE_TYPES = [
  "RP / Relations presse", "PR Manager", "Influence Manager", "Brand Manager", "Marketing Manager",
  "Partnership Manager", "Social Media Manager", "Community Manager", "Content Manager",
  "Direction / Fondateur", "Agence", "Label / Artiste", "Autre",
] as const;

export const CLASSIFICATIONS = {
  positive: { label: "Positive", tone: "green" },
  info_request: { label: "Demande d'informations", tone: "blue" },
  neutral: { label: "Neutre", tone: "slate" },
  negative: { label: "Négative", tone: "red" },
  automatic: { label: "Réponse automatique", tone: "amber" },
} as const;
export type Classification = keyof typeof CLASSIFICATIONS;

export const INTENTS = {
  pricing_request: "Demande de tarifs",
  media_kit_request: "Demande de Media Kit",
  meeting: "Proposition de rendez-vous",
  partnership: "Proposition de partenariat",
  opt_out: "Demande de ne plus être contacté",
} as const;
export type Intent = keyof typeof INTENTS;

export const INTERACTION_TYPES = {
  call: "Appel",
  meeting: "Réunion",
  note: "Note",
  proposal: "Proposition",
  document: "Document",
  gift_received: "Produit reçu",
} as const;

export const DEAL_STATUS = {
  proposed: "Proposée",
  signed: "Signée",
  in_progress: "En cours",
  delivered: "Livrée",
  cancelled: "Annulée",
  lost: "Perdue",
} as const;
export type DealStatus = keyof typeof DEAL_STATUS;
export const SIGNED_STATUSES: DealStatus[] = ["signed", "in_progress", "delivered"];

export const DOC_STATUS = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  overdue: "En retard",
  cancelled: "Annulé",
} as const;
export type DocStatus = keyof typeof DOC_STATUS;

export const COMPANY_SIZES = ["Indépendant", "TPE (< 10)", "PME (10-250)", "ETI (250-5000)", "Grand groupe (5000+)"] as const;
export const BRAND_TYPES = ["Marque grand public", "Marque indépendante", "Retailer / revendeur", "Plateforme / app", "Label / artiste", "Lieu / établissement", "Événement / festival", "Agence"] as const;

/** Nombre maximal de relances sans réponse avant blocage. */
export const MAX_FOLLOW_UPS = 2;
