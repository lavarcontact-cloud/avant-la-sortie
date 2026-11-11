// Garde-fous éthiques : secteurs et pratiques exclus.
const BLOCKED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bcasino|\bjeux? d'argent|\bparis? sportifs?|\bbetting\b|\bbookmaker|\bpoker\b|\bgambling/i, reason: "Casinos et jeux d'argent" },
  { pattern: /\bforex\b|\bcfd\b|copy[\s-]?trading|\btrading\b|signaux de trading|\bprop firm/i, reason: "Trading, Forex, CFD, copy trading" },
  { pattern: /\bmlm\b|marketing de réseau|multi[\s-]?level|pyramid|pyramidal|vente pyramidale/i, reason: "MLM et systèmes pyramidaux" },
  { pattern: /\bcrypto|\bmemecoin|\bico\b|\bnft\b|\bairdrop/i, reason: "Crypto spéculative" },
  { pattern: /argent facile|devenir riche|revenus? passifs? garanti|rendement garanti|get rich/i, reason: "Promesses financières trompeuses" },
];

export function checkEthics(...texts: (string | null | undefined)[]): { ok: true } | { ok: false; reason: string } {
  const text = texts.filter(Boolean).join(" \n ");
  for (const b of BLOCKED) if (b.pattern.test(text)) return { ok: false, reason: b.reason };
  return { ok: true };
}

export const EXCLUDED_LIST = [
  "Casinos et jeux d'argent", "Trading, Forex, CFD et copy trading", "Arnaques et promesses financières trompeuses",
  "MLM et systèmes pyramidaux", "Crypto spéculative", "Faux témoignages, faux chiffres, faux partenariats", "Publicités dissimulées",
];
