// Copilote « Vigie » — moteur de réponse DÉTERMINISTE.
// Il ne fait que lire les résultats du moteur financier et des données, puis les
// organise en sections séparées (faits, données, hypothèses, scénarios, risques,
// incertitude). Il n'invente aucun chiffre : chaque nombre affiché provient
// d'un calcul traçable. S'il manque une donnée essentielle, il s'abstient.

import type { AssetId, LedgerState, Limits, Quote } from '../engine/types';
import type { Series } from '../data/snapshot';
import type { RadarAlert } from '../engine/radar';
import { valuate, type Marks } from '../engine/ledger';
import { correlation, logReturns, median, realizedVol, rsi, sma, donchian } from '../engine/indicators';
import { shock, exposure, positionSize, historicalVaR } from '../engine/risk';
import { analyzeGoal } from '../engine/goal';

export type Level = 'debutant' | 'confirme' | 'expert';
export type Mood = 'calme' | 'attentif' | 'alerte' | 'reserve';
export type Freshness = 'fresh' | 'delayed' | 'stale';

export interface DataStatus {
  kind: 'live' | 'snapshot';
  freshness: Freshness;
  at: number; // horodatage de la donnée la plus récente utilisée
  source: string;
}

export interface CopilotContext {
  now: number;
  level: Level;
  series: Record<AssetId, Series>;
  quotes: Partial<Record<AssetId, Quote>>;
  status: DataStatus;
  ledger: LedgerState;
  marks: Marks;
  limits: Limits;
  peakEquity: number;
  alerts: RadarAlert[];
  newsSource: null; // aucune source d'actualités vérifiée n'est connectée dans ce MVP
}

export interface DataPoint { label: string; value: string; source: string }
export interface ScenarioItem { name: string; condition: string; implication: string }

export interface Answer {
  intent: Intent;
  asset?: AssetId;
  title: string;
  summary: string;
  facts: string[];
  data: DataPoint[];
  hypotheses: string[];
  scenarios: ScenarioItem[];
  risks: string[];
  uncertainty: string[];
  updatedAt: number;
  abstained: boolean;
  mood: Mood;
  followUps: string[];
}

export type Intent =
  | 'why_move' | 'events' | 'scenarios' | 'invalidation' | 'shock' | 'fees' | 'risk_trade'
  | 'learn' | 'goal' | 'portfolio' | 'advice' | 'greeting' | 'unknown';

const RULES: [Intent, RegExp][] = [
  ['advice', /((dois[- ]je|faut[- ]il|je (dois|devrais)|tu (me )?conseilles?( d')?)\s*(acheter|vendre|investir|entrer|sortir|miser|placer)|c'?est le moment|vendre maintenant|acheter maintenant)/i],
  ['shock', /(baisse|chute|hausse|recul|krach)\s+(de\s+)?[-+]?\d+([.,]\d+)?\s*%|[-+]?\d+([.,]\d+)?\s*%.*(position|portefeuille)/i],
  ['goal', /(objectif|100\s?000|100k|multiplier|devenir riche|doubler|x10)/i],
  ['fees', /(frais|commission|coût|cout|spread|glissement|slippage)/i],
  ['risk_trade', /(trop risqu|risque|taille de position|combien (acheter|investir|miser)|stop)/i],
  ['invalidation', /(invalid|rendrait .*faux|contredi|qu'?est-ce qui (ferait|changerait))/i],
  ['scenarios', /(scénario|scenario|et si|que peut[- ]il|suite possible|perspectives?)/i],
  ['events', /(événement|evenement|actualit|news|annonce|agenda|calendrier|fed|bce|etf)/i],
  ['why_move', /(pourquoi|que se passe|ça (monte|baisse)|explique.*(mouvement|hausse|baisse))/i],
  ['portfolio', /(mon portefeuille|ma position|mes positions|où j'?en suis|mon capital|mon solde|bilan)/i],
  ['learn', /(apprendre|notion|débuter|debuter|comprendre|c'?est quoi|qu'?est-ce qu|définition|expliquer?)/i],
  ['greeting', /^(salut|bonjour|hello|coucou|hey)\b/i],
];

export function classify(q: string): Intent {
  for (const [intent, re] of RULES) if (re.test(q)) return intent;
  return 'unknown';
}

export function detectAsset(q: string): AssetId | undefined {
  if (/\b(eth|ether|ethereum)\b/i.test(q)) return 'ETH';
  if (/\b(btc|bitcoin)\b/i.test(q)) return 'BTC';
  return undefined;
}

const nf = (x: number, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const eur = (x: number, d = 2) => `${nf(x, d)} €`;
export const pc = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${nf(x * 100, d)} %`;
export const dt = (t: number) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
const day = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

function staleNote(ctx: CopilotContext): string[] {
  if (ctx.status.kind === 'snapshot') return [`Données figées : snapshot ${ctx.status.source} collecté le ${dt(ctx.status.at)}. Je décris la situation à cette date, pas celle d'aujourd'hui.`];
  if (ctx.status.freshness === 'stale') return [`Le flux temps réel est interrompu depuis le ${dt(ctx.status.at)}. Les chiffres ci-dessous peuvent ne plus refléter le marché.`];
  if (ctx.status.freshness === 'delayed') return ['Flux temps réel ralenti : cotation de plus de 15 secondes.'];
  return [];
}

function base(ctx: CopilotContext, intent: Intent, asset?: AssetId): Answer {
  return { intent, asset, title: '', summary: '', facts: [], data: [], hypotheses: [], scenarios: [], risks: [], uncertainty: staleNote(ctx), updatedAt: ctx.status.at, abstained: false, mood: 'calme', followUps: [] };
}

/** Lecture factuelle d'un actif à partir des bougies clôturées (+ cotation si disponible). */
export function marketRead(ctx: CopilotContext, asset: AssetId) {
  const s = ctx.series[asset];
  const c = s.candles;
  const n = c.length;
  const closes = c.map((x) => x.c);
  const last = c[n - 1], prev = c[n - 2];
  const q = ctx.quotes[asset];
  const price = q?.last ?? last.c;
  const r1 = last.c / prev.c - 1;
  const r7 = last.c / c[n - 8].c - 1;
  const r30 = last.c / c[n - 31].c - 1;
  const volRatio = last.v / median(c.slice(n - 21, n - 1).map((x) => x.v));
  const v7 = realizedVol(closes, 7), v90 = realizedVol(closes, 90);
  const s50 = sma(closes, 50)[n - 1];
  const r14 = rsi(closes)[n - 1];
  const dc = donchian(c, 20);
  const other: AssetId = asset === 'BTC' ? 'ETH' : 'BTC';
  const oc = ctx.series[other].candles;
  const rho = correlation(logReturns(closes.slice(-31)).slice(1), logReturns(oc.slice(-31).map((x) => x.c)).slice(1));
  const otherR1 = oc[oc.length - 1].c / oc[oc.length - 2].c - 1;
  return { s, last, price, q, r1, r7, r30, volRatio, v7, v90, s50, r14, hi20: dc.upper[n - 1], lo20: dc.lower[n - 1], other, rho, otherR1 };
}

export function answer(question: string, ctx: CopilotContext): Answer {
  const intent = classify(question.trim());
  const asset = detectAsset(question) ?? 'BTC';
  const hasBreach = ctx.alerts.some((a) => a.severity === 'important');
  const a = route(intent, question, asset, ctx);
  if (a.mood === 'calme' && hasBreach) a.mood = 'attentif';
  if (ctx.status.freshness === 'stale' && ctx.status.kind === 'live') a.mood = 'reserve';
  return a;
}

function route(intent: Intent, question: string, asset: AssetId, ctx: CopilotContext): Answer {
  switch (intent) {
    case 'why_move': return whyMove(ctx, asset);
    case 'events': return events(ctx, asset);
    case 'scenarios': case 'invalidation': return scenarios(ctx, asset, intent);
    case 'shock': return shockAnswer(ctx, question, detectAsset(question));
    case 'fees': return fees(ctx);
    case 'risk_trade': return riskTrade(ctx, asset);
    case 'goal': return goal(ctx, question);
    case 'portfolio': return portfolio(ctx);
    case 'advice': return advice(ctx, asset);
    case 'learn': return learn(ctx, question);
    case 'greeting': {
      const a = base(ctx, intent);
      a.title = 'Bonjour, je suis Vigie.';
      a.summary = 'Je lis les données de marché disponibles et ton portefeuille simulé, puis je t\'explique ce qu\'ils montrent, en séparant les faits des hypothèses. Je ne prédis pas les cours et je ne donne pas d\'ordre d\'achat ou de vente.';
      a.followUps = ['Pourquoi Bitcoin bouge aujourd\'hui ?', 'Quel serait l\'impact d\'une baisse de 5 % sur ma position ?', 'Quels frais je paie ?'];
      return a;
    }
    default: {
      const a = base(ctx, 'unknown');
      a.title = 'Je n\'ai pas compris la question';
      a.summary = 'Je réponds aux questions sur les mouvements de BTC et ETH, les scénarios, les risques de ta simulation, les frais, ton objectif et les notions de base.';
      a.followUps = ['Pourquoi ETH baisse ?', 'Quels scénarios pour Bitcoin ?', 'Qu\'est-ce que la volatilité ?'];
      return a;
    }
  }
}

function whyMove(ctx: CopilotContext, asset: AssetId): Answer {
  const a = base(ctx, 'why_move', asset);
  const m = marketRead(ctx, asset);
  const dir = m.r1 >= 0 ? 'hausse' : 'baisse';
  a.title = `${asset} : ${pc(m.r1)} sur la dernière séance clôturée`;
  a.facts.push(`Clôture du ${day(m.last.t)} : ${eur(m.last.c, 0)} (${pc(m.r1)} sur la séance, ${pc(m.r7)} sur 7 jours, ${pc(m.r30)} sur 30 jours).`);
  if (m.q) a.facts.push(`Dernière cotation temps réel : ${eur(m.q.last, 0)} à ${dt(m.q.at)}.`);
  a.facts.push(`${m.other} a fait ${pc(m.otherR1)} sur la même séance ; corrélation 30 jours des rendements : ${nf(m.rho)}.`);
  a.data.push(
    { label: 'Volume vs médiane 20 j', value: `${nf(m.volRatio)}×`, source: m.s.source },
    { label: 'Volatilité 7 j / 90 j (annualisée)', value: `${nf(m.v7 * 100, 0)} % / ${nf(m.v90 * 100, 0)} %`, source: 'calcul local' },
    { label: 'Position vs moyenne 50 j', value: `${pc(m.last.c / m.s50 - 1)}`, source: 'calcul local' },
    { label: 'RSI 14', value: nf(m.r14, 0), source: 'calcul local' },
  );
  a.summary = `Je ne peux pas te dire POURQUOI ${asset} est en ${dir} : aucune source d'actualités vérifiée n'est connectée, et attribuer une cause sans source serait inventer. Je peux en revanche décrire COMMENT le mouvement s'est produit.`;
  if (m.rho > 0.7 && Math.sign(m.r1) === Math.sign(m.otherR1)) a.hypotheses.push(`${asset} et ${m.other} ont bougé dans le même sens avec une corrélation élevée : le mouvement ressemble davantage à un mouvement de l'ensemble du marché crypto qu'à une nouvelle propre à ${asset}. C'est une hypothèse, pas un fait.`);
  else a.hypotheses.push(`${asset} s'est écarté de ${m.other} : un facteur propre à ${asset} est plausible, mais rien dans les données de prix ne permet de l'identifier.`);
  if (m.volRatio > 1.5) a.hypotheses.push(`Volume élevé (${nf(m.volRatio)}× la normale) : le mouvement a impliqué plus d'échanges que d'habitude, ce qui le rend plus significatif qu'une variation à faible volume.`);
  else a.hypotheses.push('Volume proche de la normale : le mouvement n\'a pas mobilisé d\'activité exceptionnelle.');
  a.risks.push('Une séance isolée ne fait pas une tendance.');
  a.uncertainty.push('Volume d\'une seule plateforme (Coinbase), en EUR. Les causes macroéconomiques, réglementaires ou les flux ne sont pas observés ici.');
  a.followUps = [`Quels scénarios pour ${asset} ?`, `Qu'est-ce qui invaliderait une hausse de ${asset} ?`, 'Qu\'est-ce que la volatilité ?'];
  a.mood = Math.abs(m.r1) > 0.05 ? 'attentif' : 'calme';
  return a;
}

function events(ctx: CopilotContext, asset: AssetId): Answer {
  const a = base(ctx, 'events', asset);
  a.abstained = true;
  a.mood = 'reserve';
  a.title = 'Pas de source d\'événements connectée';
  a.summary = 'Je n\'ai accès à aucun flux d\'actualités ni calendrier économique vérifié dans cette version. Je ne citerai donc aucun événement daté : ce serait inventer.';
  a.facts.push('Catégories d\'événements qui influencent historiquement les crypto-actifs (connaissance générale, pas des événements à venir) : décisions de taux des banques centrales, publications d\'inflation, flux des fonds cotés, décisions réglementaires, incidents de sécurité sur des plateformes, mises à jour de protocole.');
  const recent = ctx.alerts.filter((x) => x.asset === asset).slice(0, 3);
  if (recent.length) a.facts.push(`Ce que je détecte dans les données de prix : ${recent.map((x) => x.title).join(' ; ')}.`);
  a.uncertainty.push('Connecter une source d\'actualités vérifiée est prévu dans la feuille de route.');
  a.followUps = [`Pourquoi ${asset} bouge ?`, 'Ouvrir le radar'];
  return a;
}

function scenarios(ctx: CopilotContext, asset: AssetId, intent: Intent): Answer {
  const a = base(ctx, intent, asset);
  const m = marketRead(ctx, asset);
  const atrPct = m.v7 / Math.sqrt(365);
  a.title = `${asset} : scénarios conditionnels`;
  a.summary = 'Ces scénarios ne sont pas des prévisions : ce sont des conditions observables, chacune liée à un niveau de prix calculé. Aucune probabilité n\'est attribuée, car aucun modèle calibré ne le permet ici.';
  a.facts.push(`Cours de référence : ${eur(m.price, 0)}. Plus haut 20 j : ${eur(m.hi20, 0)}. Plus bas 20 j : ${eur(m.lo20, 0)}. Moyenne 50 j : ${eur(m.s50, 0)}.`);
  a.data.push({ label: 'Amplitude quotidienne typique (vol. 7 j / √365)', value: `± ${nf(atrPct * 100, 1)} %`, source: 'calcul local' });
  a.scenarios.push(
    { name: 'Poursuite haussière', condition: `Clôture au-dessus de ${eur(m.hi20, 0)} (plus haut 20 j)`, implication: 'Le cours sort du canal récent par le haut. Les cassures échouent souvent : une rechute sous ce niveau la rendrait caduque.' },
    { name: 'Range', condition: `Clôtures entre ${eur(m.lo20, 0)} et ${eur(m.hi20, 0)}`, implication: 'Pas de direction confirmée. Les stratégies de tendance y perdent souvent en frais et en faux signaux.' },
    { name: 'Repli', condition: `Clôture sous ${eur(m.lo20, 0)} (plus bas 20 j)`, implication: 'Le support récent cède. Le risque de baisse supplémentaire augmente sans être certain.' },
  );
  a.risks.push(`Scénario haussier invalidé par une clôture sous ${eur(Math.min(m.s50, m.lo20), 0)}.`, `Scénario baissier invalidé par une clôture au-dessus de ${eur(Math.max(m.s50, m.hi20), 0)}.`, 'Un mouvement brusque (gap) peut traverser un niveau sans s\'y arrêter.');
  a.hypotheses.push('Les niveaux des 20 derniers jours servent de repères parce qu\'ils sont objectifs et vérifiables, pas parce qu\'ils auraient un pouvoir prédictif démontré.');
  a.followUps = [`Surveiller l'invalidation du scénario haussier ${asset}`, 'Qu\'est-ce qu\'un canal de Donchian ?'];
  return a;
}

function parseShock(q: string): number | undefined {
  const m = q.match(/([-+]?\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return undefined;
  let v = parseFloat(m[1].replace(',', '.')) / 100;
  if (/(baisse|chute|recul|krach|perd)/i.test(q) && v > 0) v = -v;
  return v;
}

function shockAnswer(ctx: CopilotContext, q: string, asset?: AssetId): Answer {
  const a = base(ctx, 'shock', asset);
  const pct = parseShock(q);
  const v = valuate(ctx.ledger, ctx.marks);
  if (pct === undefined || Math.abs(pct) > 1) {
    a.title = 'Variation non reconnue'; a.summary = 'Indique une variation comprise entre -100 % et +100 %, par exemple : « baisse de 5 % sur ma position BTC ».'; return a;
  }
  if (!v.lines.length) {
    a.title = 'Aucune position ouverte';
    a.summary = `Ton portefeuille simulé ne contient que des liquidités (${eur(v.cash)}) : une variation de ${pc(pct, 0)} des cours ne change pas sa valeur.`;
    a.followUps = ['Comment calculer une taille de position ?'];
    return a;
  }
  const targets = asset ? [asset] : v.lines.map((l) => l.asset);
  const shocks = Object.fromEntries(targets.map((t) => [t, pct]));
  const r = shock(ctx.ledger, ctx.marks, shocks);
  a.title = `Choc de ${pc(pct, 0)} sur ${targets.join(' + ')}`;
  a.summary = `Ton capital simulé passerait de ${eur(r.equityBefore)} à ${eur(r.equityAfter)}, soit ${eur(r.delta)} (${pc(r.deltaPct, 2)}).`;
  for (const l of r.lines) a.data.push({ label: `Impact sur ${l.asset}`, value: eur(l.delta), source: 'stress test local' });
  a.hypotheses.push('Choc instantané, positions inchangées, sans frais de sortie : c\'est une photographie, pas une simulation de ce que tu ferais.');
  const ex = exposure(ctx.ledger, ctx.marks);
  if (ex.largestWeight > ctx.limits.maxPositionPct) a.risks.push(`Concentration : ta plus grosse ligne pèse ${nf(ex.largestWeight * 100, 0)} % du portefeuille, au-delà de ta limite.`);
  const c = ctx.series[targets[0]].candles;
  const vr = historicalVaR(logReturns(c.map((x) => x.c)).map((x) => Math.exp(x) - 1), 0.95);
  if (!vr.insufficient) a.facts.push(`Pour situer : sur ${vr.n} séances, ${targets[0]} a perdu plus de ${nf(vr.var * 100, 1)} % en une journée environ une séance sur vingt (VaR historique 95 %).`);
  a.mood = r.deltaPct < -ctx.limits.maxRiskPerTradePct * 3 ? 'attentif' : 'calme';
  a.followUps = ['Qu\'est-ce que la VaR ?', 'Pourquoi mon opération pourrait être trop risquée ?'];
  return a;
}

function fees(ctx: CopilotContext): Answer {
  const a = base(ctx, 'fees');
  const s = ctx.ledger, e = s.execution;
  a.title = 'Les frais de ta simulation';
  a.summary = `Chaque exécution coûte ${nf(e.feeRate * 100, 2)} % de frais explicites. S'y ajoutent des coûts implicites : un demi-écart achat/vente (${nf(e.spreadBps / 2, 1)} pb supposés si la cotation n'est pas connue) et un glissement de ${nf(e.slippageBps, 1)} pb sur les ordres au marché.`;
  a.data.push(
    { label: 'Frais payés', value: eur(s.feesPaid), source: 'journal de simulation' },
    { label: 'Coûts implicites estimés', value: eur(s.implicitCosts), source: 'journal de simulation' },
    { label: 'Exécutions', value: String(s.fills.length), source: 'journal de simulation' },
  );
  const rt = 2 * e.feeRate + (e.spreadBps + 2 * e.slippageBps) / 1e4;
  a.facts.push(`Un aller-retour (achat puis vente) coûte environ ${nf(rt * 100, 2)} % : le cours doit progresser d'au moins autant pour que l'opération soit à l'équilibre.`);
  a.hypotheses.push('Le taux de frais est un paramètre de simulation, modifiable dans Réglages. Il n\'est pas le tarif vérifié d\'une plateforme précise : compare toujours avec la grille tarifaire officielle de ton intermédiaire.');
  a.followUps = ['Combien de transactions pour mon objectif ?', 'Mon bilan de simulation'];
  return a;
}

function riskTrade(ctx: CopilotContext, asset: AssetId): Answer {
  const a = base(ctx, 'risk_trade', asset);
  const v = valuate(ctx.ledger, ctx.marks);
  const m = marketRead(ctx, asset);
  const stop = Math.min(m.lo20, m.price * 0.95);
  const ps = positionSize({ equity: v.equity, riskPct: ctx.limits.maxRiskPerTradePct, entry: m.price, stop, feeRate: ctx.ledger.execution.feeRate, maxCash: v.availableCash });
  a.title = `Taille de position compatible avec ta limite (${nf(ctx.limits.maxRiskPerTradePct * 100, 1)} % par opération)`;
  a.summary = `Exemple de calcul, pas une recommandation : avec une entrée à ${eur(m.price, 0)} et un stop à ${eur(stop, 0)} (${pc(stop / m.price - 1)}), ta limite autorise au plus ${nf(ps.qty, 6)} ${asset}, soit ${eur(ps.qty * m.price)}.`;
  a.facts.push(`Perte au stop, frais inclus : ${eur(ps.riskAmount ?? 0)} = ${nf(ctx.limits.maxRiskPerTradePct * 100, 1)} % de ton capital simulé de ${eur(v.equity)}.`);
  a.data.push({ label: 'Stop d\'exemple', value: 'min(plus bas 20 j ; cours − 5 %)', source: 'règle documentée' });
  a.risks.push('Une opération devient trop risquée quand la perte au stop dépasse ta limite, quand aucun stop n\'est défini, ou quand une seule ligne concentre l\'essentiel du capital.');
  a.risks.push(`Volatilité 7 j : ${nf(m.v7 * 100, 0)} % annualisés. Un stop plus serré que l'amplitude quotidienne typique sera touché par le simple bruit du marché.`);
  if (ps.capped) a.uncertainty.push('Taille plafonnée par tes liquidités disponibles.');
  a.hypotheses.push('Le stop est supposé exécuté exactement à son prix. En cas de gap, la perte réelle peut être plus élevée.');
  a.followUps = ['Ouvrir le calculateur de position', `Quels scénarios pour ${asset} ?`];
  return a;
}

function goal(ctx: CopilotContext, q: string): Answer {
  const a = base(ctx, 'goal');
  const nums = [...q.matchAll(/(\d[\d\s]*)(k|\s?000)?\s*€?/gi)].map((m) => parseFloat(m[1].replace(/\s/g, '')) * (m[2]?.toLowerCase() === 'k' ? 1000 : 1)).filter((x) => x > 0);
  const capital = valuate(ctx.ledger, ctx.marks).equity || 1000;
  const target = nums.find((x) => x > capital) ?? 100_000;
  const g = analyzeGoal({ capital, target, days: 90, feeRate: ctx.ledger.execution.feeRate, tradesPerMonth: 20 }, ctx.series.BTC.candles);
  a.title = `${eur(capital, 0)} → ${eur(target, 0)} en 3 mois`;
  a.summary = g.explanation[0];
  a.facts.push(...g.explanation.slice(1));
  a.risks.push('Viser un multiple élevé à court terme impose un levier ou une concentration qui rendent la perte totale probable. Aucune méthode connue ne transforme cet objectif en résultat fiable.');
  a.mood = g.verdict === 'hors_historique' ? 'alerte' : 'attentif';
  a.followUps = ['Ouvrir le calculateur d\'objectif', 'Qu\'est-ce que le levier ?'];
  return a;
}

function portfolio(ctx: CopilotContext): Answer {
  const a = base(ctx, 'portfolio');
  const v = valuate(ctx.ledger, ctx.marks);
  a.title = 'Ton portefeuille SIMULÉ';
  a.summary = `Capital simulé : ${eur(v.equity)} pour ${eur(ctx.ledger.initialCapital)} de départ (${pc(v.netReturn, 2)} net). Rien de tout cela n'est de l'argent réel.`;
  a.data.push(
    { label: 'Réalisé brut', value: eur(v.realizedGross), source: 'journal' },
    { label: 'Latent', value: eur(v.unrealized), source: 'valorisation au dernier cours' },
    { label: 'Frais', value: eur(-v.feesPaid), source: 'journal' },
    { label: 'Liquidités disponibles', value: eur(v.availableCash), source: 'journal' },
  );
  for (const l of v.lines) a.facts.push(`${l.asset} : ${nf(l.qty, 6)} au prix moyen de ${eur(l.avgPrice)} ; valeur ${eur(l.value)} (${pc(l.unrealizedPct)}).`);
  const dd = ctx.peakEquity > 0 ? v.equity / ctx.peakEquity - 1 : 0;
  if (-dd > ctx.limits.maxDrawdownPct) { a.risks.push(`Le capital simulé est ${nf(-dd * 100, 1)} % sous son plus haut : ta limite de repli est dépassée.`); a.mood = 'alerte'; }
  if (v.missingMarks.length) a.uncertainty.push(`Cours manquant pour ${v.missingMarks.join(', ')} : valeur non calculée.`);
  a.followUps = ['Quel serait l\'impact d\'une baisse de 10 % ?', 'Quels frais je paie ?'];
  return a;
}

function advice(ctx: CopilotContext, asset: AssetId): Answer {
  const a = base(ctx, 'advice', asset);
  const m = marketRead(ctx, asset);
  a.mood = 'reserve';
  a.title = 'Je ne te dirai pas d\'acheter ou de vendre';
  a.summary = 'Je ne connais ni ta situation financière complète, ni tes objectifs, ni ta tolérance au risque, et je ne suis pas un conseiller agréé. Voici plutôt les questions que tout professionnel se poserait avant d\'agir.';
  a.facts.push(
    `Où l'idée est-elle fausse ? Sans niveau d'invalidation (par exemple le plus bas 20 j à ${eur(m.lo20, 0)}), il n'y a pas de plan.`,
    `Combien suis-je prêt à perdre si j'ai tort ? Ta limite actuelle : ${nf(ctx.limits.maxRiskPerTradePct * 100, 1)} % du capital par opération.`,
    'Cette opération augmente-t-elle ma concentration sur un seul actif ?',
    'Puis-je la tester d\'abord en simulation ?',
  );
  a.hypotheses.push('Rester en observation est une décision légitime quand le scénario n\'est pas clair. Elle ne coûte pas de frais.');
  a.followUps = [`Quels scénarios pour ${asset} ?`, 'Pourquoi cette opération pourrait-elle être trop risquée ?'];
  return a;
}

export const LESSONS: Record<string, { title: string; body: string; expert?: string }> = {
  volatilite: { title: 'La volatilité', body: 'La volatilité mesure l\'ampleur habituelle des variations de prix. Une volatilité annualisée de 50 % signifie, très grossièrement, que des variations quotidiennes de l\'ordre de 2,6 % (50 % ÷ √365) sont ordinaires. Plus elle est élevée, plus il faut réduire la taille de position pour garder le même risque.', expert: 'Écart-type des rendements log quotidiens × √365. Ici estimée sur fenêtres glissantes 7 j et 90 j ; non stationnaire.' },
  levier: { title: 'Le levier', body: 'Le levier multiplie l\'exposition au-delà du capital. Avec ×10, une baisse de 10 % efface tout le capital. Il amplifie les gains comme les pertes, et ajoute des coûts de financement. Ce simulateur ne propose pas de levier.' },
  stop: { title: 'Le stop', body: 'Le stop est le niveau où tu considères que ton idée est fausse et où tu sors. Il se décide AVANT d\'entrer. Il borne la perte… sauf si le marché saute le niveau (gap).' },
  spread: { title: 'Spread et glissement', body: 'Le spread est l\'écart entre le meilleur prix acheteur et le meilleur prix vendeur. Un ordre au marché achète au prix vendeur et vend au prix acheteur : tu payes cet écart. Le glissement est la différence entre le prix attendu et le prix obtenu quand le marché bouge ou manque de liquidité.' },
  var: { title: 'La VaR historique', body: 'La « Value at Risk » historique à 95 % est la perte journalière dépassée environ une séance sur vingt dans le passé observé. Ce n\'est pas une perte maximale : les 5 % restants peuvent être bien pires, et le passé ne garantit rien.' },
  donchian: { title: 'Le canal de Donchian', body: 'Le canal relie le plus haut et le plus bas des N dernières séances. Une clôture au-dessus du plus haut est une « cassure ». C\'est un repère objectif, pas une prédiction.' },
  drawdown: { title: 'Le drawdown', body: 'Le drawdown (repli) est la baisse depuis le plus haut atteint. Une perte de 50 % exige ensuite +100 % pour revenir au point de départ : protéger le capital compte plus que maximiser le gain.' },
  diversification: { title: 'Corrélation et diversification', body: 'Deux actifs très corrélés montent et baissent ensemble. En détenir deux ne réduit alors presque pas le risque. BTC et ETH sont historiquement fortement corrélés.' },
};

function learn(ctx: CopilotContext, q: string): Answer {
  const a = base(ctx, 'learn');
  a.uncertainty = [];
  const key = Object.keys(LESSONS).find((k) => q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(k.slice(0, 5)))
    ?? (/(var|value at risk)/i.test(q) ? 'var' : undefined) ?? (/(corr|diversif)/i.test(q) ? 'diversification' : undefined);
  if (!key) {
    a.title = 'Par où commencer ?';
    a.summary = 'Avant d\'utiliser un instrument, maîtrise ces notions dans cet ordre : volatilité, taille de position et stop, frais et spread, drawdown, corrélation. Le levier vient en dernier, s\'il vient.';
    a.followUps = Object.values(LESSONS).slice(0, 4).map((l) => `C'est quoi ${l.title.toLowerCase()} ?`);
    return a;
  }
  const l = LESSONS[key];
  a.title = l.title;
  a.summary = ctx.level === 'expert' && l.expert ? `${l.body} ${l.expert}` : l.body;
  a.followUps = ['Un exercice sur cette notion', 'Notion suivante'];
  return a;
}
