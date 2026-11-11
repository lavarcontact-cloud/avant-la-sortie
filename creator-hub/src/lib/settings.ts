import { q } from "./db";

export interface LegalSettings {
  legal_name: string; trade_name: string; legal_status: string; address: string; siren: string; siret: string;
  vat_number: string; vat_exempt: boolean; iban: string; bic: string; email: string; phone: string;
  payment_terms: string; late_penalty: string; currency: string; default_vat_rate: number; ape: string;
}
export interface ProfileSettings {
  display_name: string; headline: string; pitch: string; bio: string; city: string; email: string;
  instagram: string; tiktok: string; youtube: string; linkedin: string; portfolio_url: string; media_kit_url: string; signature: string;
  stats: { label: string; value: string; source: string; date: string }[];
  references: { name: string; detail: string; year: string; url: string }[];
}
export interface NotifSettings { morning: string; midday: string; evening: string; enabled: boolean; max_follow_ups: number; follow_up_days: number }

export const DEFAULT_LEGAL: LegalSettings = {
  legal_name: "", trade_name: "", legal_status: "", address: "", siren: "", siret: "", vat_number: "", vat_exempt: true,
  iban: "", bic: "", email: "", phone: "", payment_terms: "Paiement à 30 jours à compter de la date de facture.",
  late_penalty: "", currency: "EUR", default_vat_rate: 0, ape: "",
};
export const DEFAULT_PROFILE: ProfileSettings = {
  display_name: "Sébastien Fula-Pitu", headline: "", pitch: "", bio: "", city: "", email: "", instagram: "", tiktok: "",
  youtube: "", linkedin: "", portfolio_url: "", media_kit_url: "", signature: "", stats: [], references: [],
};
export const DEFAULT_NOTIF: NotifSettings = { morning: "09:00", midday: "13:00", evening: "19:00", enabled: true, max_follow_ups: 2, follow_up_days: 7 };

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await q<{ value: T }>(`select value from settings where key=$1`, [key]);
  return r[0] ? { ...fallback, ...(r[0].value as object) } as T : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await q(`insert into settings (key, value, updated_at) values ($1,$2,now()) on conflict (key) do update set value=excluded.value, updated_at=now()`, [key, JSON.stringify(value)]);
}

/** Mentions obligatoires manquantes pour émettre une facture (France). Indicatif, non certifié. */
export function missingLegal(l: LegalSettings): string[] {
  const m: string[] = [];
  if (!l.legal_name.trim()) m.push("Nom / dénomination légale");
  if (!l.address.trim()) m.push("Adresse");
  if (!l.siret.trim() && !l.siren.trim()) m.push("SIREN ou SIRET");
  if (!l.legal_status.trim()) m.push("Statut juridique");
  if (!l.vat_exempt && !l.vat_number.trim()) m.push("Numéro de TVA intracommunautaire");
  if (!l.payment_terms.trim()) m.push("Conditions de paiement");
  if (!l.late_penalty.trim()) m.push("Pénalités de retard");
  return m;
}
