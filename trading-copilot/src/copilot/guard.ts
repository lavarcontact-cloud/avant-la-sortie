// Garde-fou anti-invention : tout nombre présent dans un texte reformulé par
// un modèle de langage doit figurer dans l'analyse déterministe d'origine.
// Sinon la reformulation est rejetée et le texte déterministe est affiché.

import type { Answer } from './copilot';

/** Extrait les nombres d'un texte, normalisés (séparateurs français et anglais). */
export function extractNumbers(text: string): string[] {
  const re = /\d{1,3}(?:[\s  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
  return (text.match(re) ?? []).map((raw) => {
    const n = parseFloat(raw.replace(/[\s  ]/g, '').replace(',', '.'));
    return String(Math.round(n * 1e6) / 1e6);
  });
}

export function answerText(a: Answer): string {
  return [
    a.title, a.summary, ...a.facts, ...a.data.map((d) => `${d.label} ${d.value}`), ...a.hypotheses,
    ...a.scenarios.map((s) => `${s.name} ${s.condition} ${s.implication}`), ...a.risks, ...a.uncertainty,
  ].join('\n');
}

// Petits entiers tolérés (énumérations, « 3 scénarios », « 1 séance sur 20 »...).
const TRIVIAL = new Set(['0', '1', '2', '3', '4', '5', '20', '100']);

export function inventedNumbers(output: string, source: Answer): string[] {
  const allowed = new Set(extractNumbers(answerText(source)));
  return extractNumbers(output).filter((n) => !allowed.has(n) && !TRIVIAL.has(n));
}
