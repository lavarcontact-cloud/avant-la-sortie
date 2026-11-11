// Calculs des devis / factures. Arrondis au centime, ligne par ligne.
export interface DocLine {
  description: string;
  quantity: number;
  unit_price: number; // HT
  discount_pct?: number; // 0..100
  vat_rate: number; // ex. 20, 10, 5.5, 0
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotals(l: DocLine) {
  const gross = round2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));
  const discount = round2(gross * ((Number(l.discount_pct) || 0) / 100));
  const ht = round2(gross - discount);
  const vat = round2(ht * ((Number(l.vat_rate) || 0) / 100));
  return { gross, discount, ht, vat, ttc: round2(ht + vat) };
}

export function docTotals(lines: DocLine[], deposit = 0, paid = 0) {
  let gross = 0, discount = 0, ht = 0, vat = 0;
  const vatByRate = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const t = lineTotals(l);
    gross += t.gross; discount += t.discount; ht += t.ht; vat += t.vat;
    const r = Number(l.vat_rate) || 0;
    const cur = vatByRate.get(r) || { base: 0, vat: 0 };
    vatByRate.set(r, { base: round2(cur.base + t.ht), vat: round2(cur.vat + t.vat) });
  }
  ht = round2(ht); vat = round2(vat);
  const ttc = round2(ht + vat);
  const alreadyPaid = round2((Number(deposit) || 0) + (Number(paid) || 0));
  return {
    gross: round2(gross), discount: round2(discount), ht, vat, ttc,
    vatByRate: [...vatByRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, v]) => ({ rate, ...v })),
    deposit: round2(Number(deposit) || 0),
    paid: round2(Number(paid) || 0),
    balance: round2(Math.max(0, ttc - alreadyPaid)),
  };
}

export function eur(n: number | null | undefined, currency = "EUR") {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
}
export function eur0(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n) || 0);
}
