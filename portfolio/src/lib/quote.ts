import { z } from "zod";

/** Schéma partagé navigateur / serveur : la validation serveur fait foi. */

export const CLIENT_ROLES = [
  { value: "artiste", label: "Artiste" },
  { value: "manager", label: "Manager" },
  { value: "label", label: "Label / maison de disques" },
  { value: "marque", label: "Marque" },
  { value: "agence", label: "Agence / production" },
  { value: "media", label: "Média" },
  { value: "autre", label: "Autre" },
] as const;

export const BUDGETS = [
  { value: "moins-1k", label: "Moins de 1 000 €" },
  { value: "1k-3k", label: "1 000 à 3 000 €" },
  { value: "3k-8k", label: "3 000 à 8 000 €" },
  { value: "plus-8k", label: "Plus de 8 000 €" },
  { value: "a-definir", label: "À définir ensemble" },
] as const;

const trimmed = (max: number) => z.string().trim().max(max);

export const quoteInput = z.object({
  service: z.enum(["clip", "photo", "direction-artistique", "contenu", "autre"], { error: "Choisissez une prestation." }),
  projectRef: trimmed(80).regex(/^[a-z0-9-]*$/).optional().or(z.literal("")),
  description: trimmed(3000).min(20, "Décrivez le projet en quelques phrases (20 caractères minimum)."),
  dateWish: trimmed(80).optional().or(z.literal("")),
  location: trimmed(120).optional().or(z.literal("")),
  budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], { error: "Indiquez une fourchette de budget." }),
  name: trimmed(120).min(2, "Indiquez votre nom."),
  email: z.email({ error: "Adresse e-mail invalide." }).max(200),
  phone: trimmed(30).regex(/^[+0-9 ().-]*$/, "Numéro invalide.").optional().or(z.literal("")),
  company: trimmed(120).optional().or(z.literal("")),
  role: z.enum(CLIENT_ROLES.map((r) => r.value) as [string, ...string[]], { error: "Indiquez qui vous êtes." }),
  clientType: z.enum(["pro", "particulier"], { error: "Précisez si vous agissez à titre professionnel." }),
  // Anti-spam : champ piège invisible + temps de remplissage minimal.
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.number().int(),
});

export type QuoteInput = z.infer<typeof quoteInput>;

/** Étapes du formulaire et champs validés à chaque étape. */
export const QUOTE_STEPS = [
  { title: "Prestation", fields: ["service"] },
  { title: "Projet", fields: ["description", "dateWish", "location", "budget"] },
  { title: "Vous", fields: ["name", "email", "phone", "company", "role", "clientType"] },
] as const;

export const MIN_FILL_MS = 4000;
