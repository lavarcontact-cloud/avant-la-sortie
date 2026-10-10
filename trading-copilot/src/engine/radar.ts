// Radar de marché : détecteurs déterministes et documentés.
// Chaque alerte porte la règle appliquée, les valeurs mesurées et l'horodatage
// de la donnée qui l'a déclenchée. Les bougies doivent être CLÔTURÉES.

import type { AssetId, Candle, Quote } from './types';
import { correlation, logReturns, mean, median, realizedVol, sma, stdev, donchian } from './indicators';

export type Severity = 'info' | 'attention' | 'important';

export interface RadarAlert {
  id: string;
  asset: AssetId | 'PORTFOLIO';
  kind: 'move' | 'volume' | 'vol_regime' | 'breakout' | 'trend' | 'drawdown' | 'range' | 'correlation' | 'spread' | 'scenario';
  severity: Severity;
  title: string;
  explanation: string;
  rule: string; // règle et seuil exacts
  metrics: Record<string, number>;
  dataAt: number; // horodatage de la donnée source
  source: string;
}

const fr = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const RANK: Record<Severity, number> = { important: 3, attention: 2, info: 1 };
const pct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

export const RULES = {
  moveZ: 2, // |rendement du jour| > 2 écarts-types des 30 jours précédents
  moveZImportant: 3,
  volumeRatio: 2, // volume > 2 × médiane des 20 jours précédents
  volRegimeHigh: 1.5, // vol 7 j / vol 90 j
  volRegimeLow: 0.6,
  donchianN: 20,
  drawdownFrom90dHigh: 0.2,
  rangeRatio: 2, // amplitude (H-L)/C > 2 × médiane 20 j
  corrHigh: 0.8, // corrélation 30 j des rendements
  spreadBps: 25, // écart achat/vente temps réel
};

export function detect(asset: AssetId, candles: Candle[], source: string): RadarAlert[] {
  const out: RadarAlert[] = [];
  const n = candles.length;
  if (n < 31) return out;
  const last = candles[n - 1];
  const closes = candles.map((c) => c.c);
  const rets = logReturns(closes);
  const r = rets[n - 1];
  const prev = rets.slice(n - 31, n - 1);
  const sd = stdev(prev), mu = mean(prev);
  const z = (r - mu) / sd;
  const simple = last.c / candles[n - 2].c - 1;
  const base = { asset, dataAt: last.t, source };

  if (Math.abs(z) >= RULES.moveZ) {
    out.push({
      ...base, id: `${asset}-move-${last.t}`, kind: 'move',
      severity: Math.abs(z) >= RULES.moveZImportant ? 'important' : 'attention',
      title: `${asset} : variation inhabituelle (${pct(simple)})`,
      explanation: `La séance clôturée affiche ${pct(simple)}, soit ${fr(z, 1)} écarts-types par rapport aux 30 séances précédentes. Un tel écart est rare dans la fenêtre récente, mais ne dit rien, à lui seul, de la suite.`,
      rule: `|z| ≥ ${RULES.moveZ} (z = rendement log du jour vs moyenne/écart-type des 30 jours précédents)`,
      metrics: { returnPct: simple, z, stdev30: sd },
    });
  }

  if (n >= 21) {
    const medVol = median(candles.slice(n - 21, n - 1).map((c) => c.v));
    const ratio = last.v / medVol;
    if (ratio >= RULES.volumeRatio) out.push({
      ...base, id: `${asset}-volume-${last.t}`, kind: 'volume', severity: ratio >= 3 ? 'attention' : 'info',
      title: `${asset} : volume ${fr(ratio, 1)}× la normale`,
      explanation: `Le volume échangé (${fr(last.v, 1)} ${asset}) est ${fr(ratio, 1)} fois la médiane des 20 séances précédentes. Volume mesuré sur une seule plateforme : il ne représente pas tout le marché.`,
      rule: `volume ≥ ${RULES.volumeRatio} × médiane 20 j`, metrics: { ratio, volume: last.v, median20: medVol },
    });

    const ranges = candles.slice(n - 21, n - 1).map((c) => (c.h - c.l) / c.c);
    const rr = ((last.h - last.l) / last.c) / median(ranges);
    if (rr >= RULES.rangeRatio) out.push({
      ...base, id: `${asset}-range-${last.t}`, kind: 'range', severity: 'info',
      title: `${asset} : amplitude intrajournalière élevée`,
      explanation: `L'écart entre plus haut et plus bas atteint ${fr(((last.h - last.l) / last.c) * 100, 1)} % du cours, ${fr(rr, 1)}× la médiane 20 j. Une amplitude forte signale un marché nerveux : le glissement et le risque d'exécution augmentent.`,
      rule: `(H-L)/C ≥ ${RULES.rangeRatio} × médiane 20 j`, metrics: { rangeRatio: rr },
    });

    const { upper, lower } = donchian(candles, RULES.donchianN);
    if (last.c > upper[n - 1]) out.push({
      ...base, id: `${asset}-bo-up-${last.t}`, kind: 'breakout', severity: 'attention',
      title: `${asset} : clôture au-dessus du plus haut 20 j`,
      explanation: `Clôture à ${fr(last.c, 2)} € au-dessus du plus haut des 20 séances précédentes (${fr(upper[n - 1], 2)} €). Configuration à surveiller : beaucoup de cassures échouent et reviennent dans le canal.`,
      rule: `clôture > max(H) des ${RULES.donchianN} jours précédents (canal de Donchian)`, metrics: { close: last.c, upper: upper[n - 1] },
    });
    if (last.c < lower[n - 1]) out.push({
      ...base, id: `${asset}-bo-down-${last.t}`, kind: 'breakout', severity: 'attention',
      title: `${asset} : clôture sous le plus bas 20 j`,
      explanation: `Clôture à ${fr(last.c, 2)} € sous le plus bas des 20 séances précédentes (${fr(lower[n - 1], 2)} €). Le support observé a cédé ; cela n'implique pas mécaniquement une poursuite de la baisse.`,
      rule: `clôture < min(B) des ${RULES.donchianN} jours précédents`, metrics: { close: last.c, lower: lower[n - 1] },
    });
  }

  if (n >= 91) {
    const v7 = realizedVol(closes, 7), v90 = realizedVol(closes, 90);
    const ratio = v7 / v90;
    if (ratio >= RULES.volRegimeHigh || ratio <= RULES.volRegimeLow) out.push({
      ...base, id: `${asset}-vol-${last.t}`, kind: 'vol_regime', severity: ratio >= RULES.volRegimeHigh ? 'attention' : 'info',
      title: ratio >= RULES.volRegimeHigh ? `${asset} : la volatilité s'accélère` : `${asset} : marché anormalement calme`,
      explanation: `Volatilité réalisée 7 j : ${fr(v7 * 100, 0)} % annualisés, contre ${fr(v90 * 100, 0)} % sur 90 j (ratio ${fr(ratio, 2)}). ${ratio >= RULES.volRegimeHigh ? 'Les écarts de prix récents sont plus larges : des stops trop serrés seront touchés plus souvent.' : 'Les phases calmes précèdent parfois des mouvements brusques ; ce n\'est pas une règle.'}`,
      rule: `vol7/vol90 ≥ ${RULES.volRegimeHigh} ou ≤ ${RULES.volRegimeLow}`, metrics: { vol7: v7, vol90: v90, ratio },
    });
    const hi90 = Math.max(...candles.slice(n - 90).map((c) => c.h));
    const dd = last.c / hi90 - 1;
    if (-dd >= RULES.drawdownFrom90dHigh) out.push({
      ...base, id: `${asset}-dd-${last.t}`, kind: 'drawdown', severity: 'info',
      title: `${asset} : ${pct(dd, 0)} depuis le plus haut 90 j`,
      explanation: `Le cours est ${fr(-dd * 100, 1)} % sous son plus haut des 90 derniers jours (${fr(hi90, 0)} €). Utile pour situer le contexte, pas pour décider seul.`,
      rule: `clôture ≤ (1 - ${RULES.drawdownFrom90dHigh}) × plus haut 90 j`, metrics: { drawdown: dd, high90: hi90 },
    });
  }

  if (n >= 51) {
    const s50 = sma(closes, 50);
    const crossedUp = closes[n - 2] <= s50[n - 2] && last.c > s50[n - 1];
    const crossedDown = closes[n - 2] >= s50[n - 2] && last.c < s50[n - 1];
    if (crossedUp || crossedDown) out.push({
      ...base, id: `${asset}-trend-${last.t}`, kind: 'trend', severity: 'info',
      title: `${asset} : clôture ${crossedUp ? 'au-dessus de' : 'sous'} la moyenne 50 j`,
      explanation: `La moyenne mobile simple 50 j est à ${fr(s50[n - 1], 0)} €. Ce croisement est fréquent et souvent annulé dans les jours suivants : à lire comme un repère de tendance, pas comme un signal.`,
      rule: 'croisement de la clôture et de la SMA 50', metrics: { sma50: s50[n - 1], close: last.c },
    });
  }
  return out;
}

export function detectCorrelation(a: AssetId, ca: Candle[], b: AssetId, cb: Candle[], source: string): RadarAlert[] {
  const n = Math.min(ca.length, cb.length);
  if (n < 31) return [];
  const ra = logReturns(ca.slice(-31).map((c) => c.c)).slice(1);
  const rb = logReturns(cb.slice(-31).map((c) => c.c)).slice(1);
  const rho = correlation(ra, rb);
  if (rho < RULES.corrHigh) return [];
  return [{
    id: `corr-${a}-${b}-${ca[ca.length - 1].t}`, asset: 'PORTFOLIO', kind: 'correlation', severity: 'info',
    title: `${a} et ${b} évoluent presque ensemble`,
    explanation: `Corrélation des rendements quotidiens sur 30 jours : ${fr(rho, 2)}. Détenir les deux diversifie peu : une baisse de l'un s'accompagne le plus souvent d'une baisse de l'autre.`,
    rule: `corrélation 30 j ≥ ${RULES.corrHigh}`, metrics: { rho }, dataAt: ca[ca.length - 1].t, source,
  }];
}

export function detectSpread(q: Quote): RadarAlert[] {
  if (q.bid === undefined || q.ask === undefined) return [];
  const bps = ((q.ask - q.bid) / ((q.ask + q.bid) / 2)) * 1e4;
  if (bps < RULES.spreadBps) return [];
  return [{
    id: `${q.asset}-spread-${q.at}`, asset: q.asset, kind: 'spread', severity: 'attention',
    title: `${q.asset} : écart achat/vente élevé (${fr(bps, 0)} pb)`,
    explanation: `L'écart entre meilleur acheteur (${q.bid}) et meilleur vendeur (${q.ask}) coûte ${fr(bps, 0)} points de base à l'aller-retour. Liquidité réduite : un ordre au marché sera exécuté moins bien.`,
    rule: `spread ≥ ${RULES.spreadBps} pb`, metrics: { bps }, dataAt: q.at, source: q.source,
  }];
}

/** Scénario déclaré par l'utilisateur ou le copilote, invalidé par une clôture franchissant un niveau. */
export interface Scenario {
  id: string;
  asset: AssetId;
  label: string;
  bias: 'haussier' | 'baissier';
  invalidation: number; // haussier : invalidé si clôture < niveau ; baissier : si clôture > niveau
  createdAt: number;
}

export function detectInvalidation(sc: Scenario, candles: Candle[], source: string): RadarAlert | null {
  const after = candles.filter((c) => c.t > sc.createdAt);
  const hit = after.find((c) => (sc.bias === 'haussier' ? c.c < sc.invalidation : c.c > sc.invalidation));
  if (!hit) return null;
  return {
    id: `scenario-${sc.id}`, asset: sc.asset, kind: 'scenario', severity: 'important',
    title: `Le scénario ${sc.bias} « ${sc.label} » est invalidé`,
    explanation: `Condition d'invalidation : clôture ${sc.bias === 'haussier' ? 'sous' : 'au-dessus de'} ${sc.invalidation} €. Clôture observée : ${hit.c} € le ${new Date(hit.t).toISOString().slice(0, 10)}. L'hypothèse de départ ne tient plus : il faut la réexaminer, pas la défendre.`,
    rule: `clôture ${sc.bias === 'haussier' ? '<' : '>'} ${sc.invalidation}`, metrics: { close: hit.c, level: sc.invalidation }, dataAt: hit.t, source,
  };
}

export function rankAlerts(alerts: RadarAlert[]): RadarAlert[] {
  return [...alerts].sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.dataAt - a.dataAt);
}

/** Historique : rejoue les détecteurs sur chaque séance (pour le fil et les tests). */
// Seule l'apparition d'une condition est signalée : une condition qui persiste
// d'une séance à l'autre ne génère pas de nouvelle alerte (pas d'urgence artificielle).
export function detectHistory(asset: AssetId, candles: Candle[], source: string, lookback = 30): RadarAlert[] {
  const out: RadarAlert[] = [];
  let prevKinds = new Set<string>();
  const start = Math.max(31, candles.length - lookback);
  for (let i = start - 1; i <= candles.length; i++) {
    const day = detect(asset, candles.slice(0, i), source);
    const kinds = new Set(day.map((a) => a.kind + (a.title.includes('calme') ? '-low' : '')));
    if (i >= start) out.push(...day.filter((a) => !prevKinds.has(a.kind + (a.title.includes('calme') ? '-low' : ''))));
    prevKinds = kinds;
  }
  return out;
}
