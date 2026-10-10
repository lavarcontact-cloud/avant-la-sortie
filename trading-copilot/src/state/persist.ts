// Persistance locale (navigateur uniquement). Aucune donnée n'est envoyée à un serveur.
// Le contenu est validé au chargement : une donnée corrompue est écartée, jamais exécutée.

import type { AssetId, ExecutionModel, LedgerEvent, Limits } from '../engine/types';
import { DEFAULT_EXECUTION, DEFAULT_LIMITS } from '../engine/types';
import type { Scenario } from '../engine/radar';
import type { Level } from '../copilot/copilot';

export type Accent = 'volt' | 'ice' | 'ember';
export interface Profile {
  name: string; // nom du copilote
  level: Level;
  accent: Accent;
  followed: AssetId[];
  onboarded: boolean;
  memoryConsent: boolean; // si faux : rien n'est conservé après fermeture de l'onglet
}

export interface Book {
  events: LedgerEvent[];
  equity: { t: number; v: number; fees: number; btc?: number }[]; // capital net, frais cumulés, cours BTC (référence)
}

export interface ReplayBook extends Book {
  exerciseId: string;
  startIdx: number;
  cursor: number; // index de la séance « en cours » (seules les séances < cursor sont visibles)
  endIdx: number;
}

export interface Persisted {
  v: 1;
  profile: Profile;
  limits: Limits;
  execution: ExecutionModel;
  live: Book;
  replay: ReplayBook | null;
  scenarios: Scenario[];
  quiz: Record<string, boolean>;
  dismissed: string[];
}

export const KEY = 'vigie.v1';

export function defaults(now: number): Persisted {
  return {
    v: 1,
    profile: { name: 'Vigie', level: 'debutant', accent: 'volt', followed: ['BTC', 'ETH'], onboarded: false, memoryConsent: false },
    limits: { ...DEFAULT_LIMITS },
    execution: { ...DEFAULT_EXECUTION },
    live: { events: [{ kind: 'init', at: now, capital: 10_000, label: 'Simulation temps réel', execution: { ...DEFAULT_EXECUTION } }], equity: [] },
    replay: null,
    scenarios: [],
    quiz: {},
    dismissed: [],
  };
}

const isNum = (x: unknown, min = -Infinity, max = Infinity) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

export function validate(x: unknown): x is Persisted {
  if (!x || typeof x !== 'object') return false;
  const p = x as Persisted;
  if (p.v !== 1 || !p.profile || !p.limits || !p.execution || !p.live) return false;
  if (!['debutant', 'confirme', 'expert'].includes(p.profile.level)) return false;
  if (!isNum(p.limits.maxPositionPct, 0, 1) || !isNum(p.limits.maxRiskPerTradePct, 0, 1) || !isNum(p.limits.maxDrawdownPct, 0, 1)) return false;
  if (!isNum(p.execution.feeRate, 0, 0.1) || !isNum(p.execution.spreadBps, 0, 1000) || !isNum(p.execution.slippageBps, 0, 1000)) return false;
  if (!Array.isArray(p.live.events) || p.live.events[0]?.kind !== 'init') return false;
  if (p.replay && (!Array.isArray(p.replay.events) || !isNum(p.replay.cursor, 0))) return false;
  return Array.isArray(p.scenarios);
}

function storage(memory: boolean): Storage | null {
  try { return memory ? window.localStorage : window.sessionStorage; } catch { return null; }
}

export function load(now: number): { state: Persisted; notice?: string } {
  for (const s of [storage(true), storage(false)]) {
    try {
      const raw = s?.getItem(KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (validate(parsed)) return { state: parsed };
      return { state: defaults(now), notice: 'Les données locales étaient illisibles : une nouvelle simulation a été créée.' };
    } catch { /* stockage indisponible ou JSON invalide */ }
  }
  return { state: defaults(now) };
}

export function save(p: Persisted) {
  const target = storage(p.profile.memoryConsent);
  const other = storage(!p.profile.memoryConsent);
  try {
    target?.setItem(KEY, JSON.stringify(p));
    other?.removeItem(KEY); // le consentement retiré efface la mémoire durable
  } catch { /* quota dépassé ou stockage bloqué : l'application continue en mémoire */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
