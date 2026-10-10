import { describe, expect, it } from 'vitest';
import { answer, classify, detectAsset, type CopilotContext } from './copilot';
import { extractNumbers, inventedNumbers } from './guard';
import { SNAPSHOT } from '../data/snapshot';
import { replay, submitOrder } from '../engine/ledger';
import { DEFAULT_EXECUTION, DEFAULT_LIMITS, type LedgerEvent } from '../engine/types';
import { parseTicker, freshness } from '../data/live';

const T = SNAPSHOT.BTC.fetchedAt;
function ctx(withPosition = false): CopilotContext {
  const evs: LedgerEvent[] = [{ kind: 'init', at: T, capital: 10_000, label: 't', execution: DEFAULT_EXECUTION }];
  const marks = { BTC: SNAPSHOT.BTC.candles.at(-1)!.c, ETH: SNAPSHOT.ETH.candles.at(-1)!.c };
  if (withPosition) {
    const r = submitOrder(replay(evs), { asset: 'BTC', side: 'buy', type: 'market', qty: 0.05 }, { asset: 'BTC', last: marks.BTC, at: T, source: 't' }, T);
    if (r.ok) evs.push(...r.events);
  }
  return {
    now: T, level: 'debutant', series: SNAPSHOT, quotes: {}, ledger: replay(evs), marks, limits: DEFAULT_LIMITS, peakEquity: 10_000, alerts: [], newsSource: null,
    status: { kind: 'snapshot', freshness: 'stale', at: T, source: 'Coinbase Exchange (snapshot)' },
  };
}

describe('classification', () => {
  it.each([
    ['Pourquoi Bitcoin monte aujourd\'hui ?', 'why_move'],
    ['Quels événements peuvent affecter ETH ?', 'events'],
    ['Quels sont les scénarios pour BTC ?', 'scenarios'],
    ['Qu\'est-ce qui invaliderait cette analyse ?', 'invalidation'],
    ['Quel serait l\'impact d\'une baisse de 5 % sur ma position ?', 'shock'],
    ['Quels frais dois-je payer ?', 'fees'],
    ['Pourquoi cette opération pourrait être trop risquée pour mon capital ?', 'risk_trade'],
    ['Quelles notions dois-je apprendre avant ?', 'learn'],
    ['Dois-je acheter du bitcoin maintenant ?', 'advice'],
    ['Comment atteindre 100 000 € en 3 mois ?', 'goal'],
  ])('%s → %s', (q, intent) => expect(classify(q)).toBe(intent));
  it('actif', () => { expect(detectAsset('et ethereum ?')).toBe('ETH'); expect(detectAsset('btc')).toBe('BTC'); });
});

describe('réponses', () => {
  it('pourquoi ça bouge : refuse d\'inventer une cause, signale les données figées', () => {
    const a = answer('Pourquoi Bitcoin baisse ?', ctx());
    expect(a.summary).toMatch(/aucune source d'actualités/);
    expect(a.uncertainty.join(' ')).toMatch(/snapshot/);
    expect(a.facts.length).toBeGreaterThan(0);
    expect(a.hypotheses.length).toBeGreaterThan(0);
    expect(a.updatedAt).toBe(T);
  });
  it('événements : abstention', () => {
    const a = answer('Quelles actualités pour ETH ?', ctx());
    expect(a.abstained).toBe(true);
  });
  it('choc de -5 % : chiffre déterministe cohérent avec le moteur', () => {
    const c = ctx(true);
    const a = answer('Quel serait l\'impact d\'une baisse de 5 % sur ma position ?', c);
    const expected = -0.05 * 0.05 * c.marks.BTC!;
    expect(a.data[0].value.replace(/\s|\u202f/g, '')).toBe(`${expected.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`.replace(/\s|\u202f/g, ''));
  });
  it('conseil personnalisé : refus encadré', () => {
    const a = answer('Dois-je acheter du bitcoin maintenant ?', ctx());
    expect(a.title).toMatch(/ne te dirai pas/);
    expect(a.mood).toBe('reserve');
  });
  it('objectif irréaliste : alerte', () => {
    const a = answer('Je veux faire 100 000 € en 3 mois', ctx());
    expect(a.mood).toBe('alerte');
  });
  it('scénarios : aucune probabilité affichée', () => {
    const a = answer('Quels scénarios pour BTC ?', ctx());
    expect(a.scenarios).toHaveLength(3);
    expect(JSON.stringify(a)).not.toMatch(/probabilité de/i);
  });
});

describe('garde-fou de reformulation', () => {
  it('extraction de nombres au format français', () => {
    expect(extractNumbers('Capital 10 000,50 € et 3,5 %')).toEqual(['10000.5', '3.5']);
  });
  it('rejette un nombre inventé, accepte une reformulation fidèle', () => {
    const a = answer('Pourquoi Bitcoin baisse ?', ctx());
    expect(inventedNumbers('Le bitcoin pourrait atteindre 120 000 € la semaine prochaine.', a)).toContain('120000');
    expect(inventedNumbers('Je ne peux pas expliquer la cause sans source d\'actualités.', a)).toHaveLength(0);
  });
});

describe('flux temps réel', () => {
  it('analyse le message ticker documenté par Coinbase', () => {
    const q = parseTicker({ type: 'ticker', product_id: 'BTC-EUR', price: '1285.22', best_bid: '1285.04', best_ask: '1285.27', time: '2022-10-19T23:28:22.061769Z' });
    expect(q).toEqual({ asset: 'BTC', last: 1285.22, bid: 1285.04, ask: 1285.27, at: Date.parse('2022-10-19T23:28:22.061769Z'), source: 'Coinbase Exchange (WebSocket)' });
  });
  it('ignore les messages invalides ou incohérents', () => {
    expect(parseTicker({ type: 'subscriptions' })).toBeNull();
    expect(parseTicker({ type: 'ticker', product_id: 'DOGE-EUR', price: '1', time: '2022-01-01T00:00:00Z' })).toBeNull();
    expect(parseTicker({ type: 'ticker', product_id: 'BTC-EUR', price: 'abc', time: '2022-01-01T00:00:00Z' })).toBeNull();
    expect(parseTicker({ type: 'ticker', product_id: 'BTC-EUR', price: '10', best_bid: '11', best_ask: '9', time: '2022-01-01T00:00:00Z' })?.bid).toBeUndefined();
  });
  it('fraîcheur', () => {
    expect(freshness(0, 5_000)).toBe('fresh');
    expect(freshness(0, 60_000)).toBe('delayed');
    expect(freshness(0, 600_000)).toBe('stale');
  });
});
