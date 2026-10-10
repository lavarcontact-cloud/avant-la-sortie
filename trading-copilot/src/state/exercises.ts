// Exercices de replay sur de VRAIES périodes historiques (snapshot Coinbase).
// Le futur reste caché : l'utilisateur ne voit que les séances déjà clôturées.

import type { Candle } from '../engine/types';

export interface Exercise {
  id: string;
  title: string;
  start: string; // date ISO de la première séance jouée
  days: number;
  brief: string;
  goal: string; // objectif pédagogique, jamais un objectif de gain
  level: 'debutant' | 'confirme' | 'expert';
}

export const EXERCISES: Exercise[] = [
  { id: 'fev-2026', title: 'Le choc de février 2026', start: '2026-01-26', days: 25, level: 'debutant',
    brief: 'Le marché vient de reculer depuis ses sommets de janvier. Tu démarres avec 10 000 € fictifs.',
    goal: 'Définir un stop avant chaque achat et garder le repli du capital sous ta limite.' },
  { id: 'juin-2026', title: 'La glissade de juin 2026', start: '2026-05-25', days: 30, level: 'confirme',
    brief: 'Après des semaines de stabilité, la volatilité se réveille.',
    goal: 'Dimensionner chaque position pour que la perte au stop ne dépasse pas 1 % du capital.' },
  { id: 'aout-2026', title: 'L\'accélération d\'août 2026', start: '2026-08-08', days: 28, level: 'confirme',
    brief: 'Le marché est calme et proche de ses plus bas récents.',
    goal: 'Comparer ton résultat net de frais à l\'achat-conservation sur la même période.' },
  { id: 'libre', title: 'Replay libre (90 dernières séances)', start: '', days: 90, level: 'expert',
    brief: 'Les 90 dernières séances du snapshot, une par une.',
    goal: 'Tenir un journal : pour chaque opération, noter l\'hypothèse et le niveau d\'invalidation.' },
];

export function exerciseRange(ex: Exercise, candles: Candle[]) {
  let startIdx = ex.start ? candles.findIndex((c) => new Date(c.t).toISOString().slice(0, 10) === ex.start) : candles.length - ex.days;
  if (startIdx < 60) startIdx = Math.max(60, startIdx); // au moins 60 séances d'historique visibles
  const endIdx = Math.min(candles.length - 1, startIdx + ex.days);
  return { startIdx, endIdx };
}
