/**
 * Consentement aux traceurs (art. 82 loi Informatique et Libertés,
 * lignes directrices et recommandation CNIL).
 *
 * - "necessaires" : toujours actifs, non désactivables (le cookie de choix
 *   lui-même, la session admin). Exemptés de consentement.
 * - "audience" : mesure d'audience first-party. Désactivée par défaut,
 *   activée uniquement sur action positive. Aucun événement n'est envoyé
 *   avant ce choix.
 *
 * Le choix est conservé 6 mois (recommandation CNIL), puis redemandé. Un
 * changement de POLICY_VERSION redemande aussi le choix.
 */

export const CONSENT_COOKIE = "sfp_consent";
export const POLICY_VERSION = "2026-10-09";
export const CONSENT_MAX_AGE_DAYS = 182;

export type ConsentChoices = { audience: boolean };
export type ConsentRecord = {
  v: string;
  id: string;
  choices: ConsentChoices;
  ts: number;
};

export function parseConsent(raw: string | undefined | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as ConsentRecord;
    if (typeof data !== "object" || !data || typeof data.choices?.audience !== "boolean") return null;
    if (data.v !== POLICY_VERSION) return null;
    if (Date.now() - data.ts > CONSENT_MAX_AGE_DAYS * 86400_000) return null;
    if (data.ts > Date.now() + 86400_000) return null; // date future : cookie altéré
    return data;
  } catch {
    return null;
  }
}

export function serializeConsent(rec: ConsentRecord): string {
  return encodeURIComponent(JSON.stringify(rec));
}
