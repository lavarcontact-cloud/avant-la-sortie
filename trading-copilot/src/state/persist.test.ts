import { describe, expect, it } from 'vitest';
import { defaults, validate } from './persist';
import { detectHistory } from '../engine/radar';
import { SNAPSHOT } from '../data/snapshot';
import { EXERCISES, exerciseRange } from './exercises';

describe('persistance', () => {
  it('accepte l\'état par défaut', () => expect(validate(defaults(0))).toBe(true));
  it('rejette les données corrompues ou hors bornes', () => {
    expect(validate(null)).toBe(false);
    expect(validate({ v: 2 })).toBe(false);
    const d = defaults(0);
    expect(validate({ ...d, limits: { ...d.limits, maxPositionPct: 5 } })).toBe(false);
    expect(validate({ ...d, execution: { ...d.execution, feeRate: -1 } })).toBe(false);
    expect(validate({ ...d, profile: { ...d.profile, level: '<script>' } })).toBe(false);
    expect(validate({ ...d, live: { events: [], equity: [] } })).toBe(false);
  });
});

describe('radar historique', () => {
  it('une condition persistante n\'est signalée qu\'à son apparition', () => {
    const al = detectHistory('BTC', SNAPSHOT.BTC.candles, 's', 60);
    const calm = al.filter((a) => a.kind === 'vol_regime' && a.title.includes('calme')).map((a) => a.dataAt);
    for (let i = 1; i < calm.length; i++) expect(calm[i] - calm[i - 1]).toBeGreaterThan(86_400_000);
  });
});

describe('exercices de replay', () => {
  it('chaque exercice tombe sur des dates réelles du snapshot avec 60 séances d\'historique', () => {
    for (const ex of EXERCISES) {
      const r = exerciseRange(ex, SNAPSHOT.BTC.candles);
      expect(r.startIdx).toBeGreaterThanOrEqual(60);
      expect(r.endIdx).toBeLessThan(SNAPSHOT.BTC.candles.length);
      if (ex.start) expect(new Date(SNAPSHOT.BTC.candles[r.startIdx].t).toISOString().slice(0, 10)).toBe(ex.start);
      expect(SNAPSHOT.ETH.candles[r.startIdx].t).toBe(SNAPSHOT.BTC.candles[r.startIdx].t);
    }
  });
});
