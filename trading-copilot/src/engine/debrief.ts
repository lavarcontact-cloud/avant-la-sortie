// Bilan d'une simulation : règles explicites, aucun jugement inventé.

import type { LedgerState, Limits } from './types';
import { valuate, type Marks } from './ledger';
import { mean } from './indicators';

export interface DebriefItem { tone: 'positive' | 'negative' | 'neutral'; title: string; detail: string }

export function debrief(s: LedgerState, marks: Marks, limits: Limits, peakEquity: number): DebriefItem[] {
  const out: DebriefItem[] = [];
  const v = valuate(s, marks);
  const t = s.closedTrades;
  if (!s.fills.length) return [{ tone: 'neutral', title: 'Aucune opération', detail: 'Pas encore d\'exécution à analyser. Rester en observation est aussi une décision : elle ne coûte pas de frais.' }];

  out.push({
    tone: v.netPnl >= 0 ? 'positive' : 'negative',
    title: `Résultat net simulé : ${v.netPnl >= 0 ? '+' : ''}${v.netPnl.toFixed(2)} € (${(v.netReturn * 100).toFixed(2)} %)`,
    detail: `Réalisé brut ${s.realizedGross.toFixed(2)} €, latent ${v.unrealized.toFixed(2)} €, frais ${s.feesPaid.toFixed(2)} €. Coûts implicites estimés (spread + glissement, déjà inclus dans les prix) : ${s.implicitCosts.toFixed(2)} €.`,
  });

  const grossAbs = Math.abs(s.realizedGross) + Math.abs(v.unrealized);
  if (grossAbs > 0 && s.feesPaid / grossAbs > 0.3) out.push({ tone: 'negative', title: 'Les frais pèsent lourd', detail: `Les frais représentent ${((s.feesPaid / grossAbs) * 100).toFixed(0)} % des gains/pertes bruts. Multiplier les transactions érode le capital, même avec de bonnes idées.` });

  const buys = s.fills.filter((f) => f.side === 'buy');
  const withStop = s.closedTrades.filter((x) => x.stopPrice !== undefined).length + Object.values(s.positions).filter((p) => p.stopPrice !== undefined).length;
  if (buys.length) {
    if (withStop === 0) out.push({ tone: 'negative', title: 'Aucun stop déclaré', detail: 'Sans niveau d\'invalidation défini à l\'avance, la perte maximale de chaque opération n\'est pas maîtrisée.' });
    else out.push({ tone: 'positive', title: 'Des stops ont été définis', detail: 'Définir à l\'avance où l\'idée est fausse est l\'habitude la plus utile en gestion du risque.' });
  }

  const breached = t.filter((x) => x.stopPrice !== undefined && x.exitPrice < x.stopPrice * 0.995);
  if (breached.length) out.push({ tone: 'negative', title: `${breached.length} sortie(s) sous le stop prévu`, detail: 'La position a été vendue plus bas que le niveau d\'invalidation choisi : le plan n\'a pas été suivi, ou le marché a sauté le niveau.' });

  const wins = t.filter((x) => x.netPnl > 0), losses = t.filter((x) => x.netPnl <= 0);
  if (wins.length && losses.length) {
    const aw = mean(wins.map((x) => x.netPnl)), al = Math.abs(mean(losses.map((x) => x.netPnl)));
    out.push(aw >= al
      ? { tone: 'positive', title: 'Gains moyens supérieurs aux pertes moyennes', detail: `Gain moyen ${aw.toFixed(2)} € contre perte moyenne ${al.toFixed(2)} €.` }
      : { tone: 'negative', title: 'Pertes moyennes supérieures aux gains moyens', detail: `Perte moyenne ${al.toFixed(2)} € contre gain moyen ${aw.toFixed(2)} €. Il faut alors un taux de réussite élevé pour rester positif.` });
  }
  if (t.length && t.length < 10) out.push({ tone: 'neutral', title: 'Échantillon réduit', detail: `${t.length} opération(s) clôturée(s) : trop peu pour juger une méthode. Le hasard domine sur un petit nombre d'opérations.` });

  const dd = peakEquity > 0 ? v.equity / peakEquity - 1 : 0;
  if (-dd > limits.maxDrawdownPct) out.push({ tone: 'negative', title: 'Limite de repli dépassée', detail: `Capital ${(-dd * 100).toFixed(1)} % sous son plus haut, au-delà de ta limite de ${(limits.maxDrawdownPct * 100).toFixed(0)} %.` });
  const maxW = Math.max(0, ...v.lines.map((l) => l.value / v.equity));
  if (maxW > limits.maxPositionPct) out.push({ tone: 'negative', title: 'Concentration au-delà de ta limite', detail: `Une ligne pèse ${(maxW * 100).toFixed(0)} % du portefeuille (limite ${(limits.maxPositionPct * 100).toFixed(0)} %).` });
  return out;
}
