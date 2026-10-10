// Types partagés du moteur. Le moteur est pur : aucune dépendance au DOM,
// au réseau ou à React. Toutes les heures sont en millisecondes UTC.

export type AssetId = 'BTC' | 'ETH';
export const ASSETS: AssetId[] = ['BTC', 'ETH'];
export const QUOTE_CCY = 'EUR';

export interface Candle {
  t: number; // ouverture de la période (ms UTC)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // volume en unités de l'actif
}

/** Cotation utilisée pour exécuter un ordre simulé. */
export interface Quote {
  asset: AssetId;
  last: number;
  bid?: number;
  ask?: number;
  at: number; // horodatage de la donnée (pas de l'affichage)
  source: string;
}

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

/** Hypothèses d'exécution, toutes explicites et configurables. */
export interface ExecutionModel {
  feeRate: number; // ex. 0.006 = 0,6 % du notionnel, appliqué à chaque exécution
  spreadBps: number; // écart achat/vente supposé quand bid/ask sont inconnus
  slippageBps: number; // glissement supposé pour un ordre au marché
}

export const DEFAULT_EXECUTION: ExecutionModel = {
  feeRate: 0.006,
  spreadBps: 10,
  slippageBps: 5,
};

export interface Order {
  id: string;
  asset: AssetId;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice?: number;
  createdAt: number;
  note?: string;
  stopPrice?: number; // stop « intention » déclaré par l'utilisateur (sert au calcul de risque et au bilan)
}

export interface Fill {
  orderId: string;
  asset: AssetId;
  side: Side;
  qty: number;
  price: number; // prix d'exécution (spread et glissement inclus)
  refPrice: number; // prix de référence avant coûts implicites
  fee: number; // frais explicites en EUR
  implicitCost: number; // coût estimé du spread + glissement en EUR
  at: number;
  quoteSource: string;
  stopPrice?: number; // stop déclaré sur l'ordre d'origine (conservé pour le risque et le bilan)
}

export type LedgerEvent =
  | { kind: 'init'; at: number; capital: number; label: string; execution: ExecutionModel }
  | { kind: 'place'; at: number; order: Order }
  | { kind: 'fill'; at: number; fill: Fill }
  | { kind: 'cancel'; at: number; orderId: string; reason: string };

export interface Position {
  asset: AssetId;
  qty: number;
  avgPrice: number; // prix moyen pondéré d'achat, hors frais
  reservedQty: number; // quantité bloquée par des ordres limite de vente
  stopPrice?: number; // stop déclaré à l'entrée
}

export interface ClosedTrade {
  asset: AssetId;
  qty: number;
  entryAvg: number;
  exitPrice: number;
  grossPnl: number; // (sortie - prix moyen) × quantité
  fees: number; // frais d'entrée au prorata + frais de sortie
  netPnl: number;
  openedAt: number;
  closedAt: number;
  stopPrice?: number;
}

export interface LedgerState {
  label: string;
  initialCapital: number;
  execution: ExecutionModel;
  cash: number; // liquidités totales
  reservedCash: number; // liquidités bloquées par des ordres limite d'achat
  positions: Record<string, Position>;
  openOrders: Order[];
  fills: Fill[];
  closedTrades: ClosedTrade[];
  realizedGross: number;
  feesPaid: number;
  implicitCosts: number;
  startedAt: number;
}

export interface Limits {
  maxPositionPct: number; // poids max d'un actif dans le portefeuille (0..1)
  maxRiskPerTradePct: number; // perte max au stop par opération (0..1 du capital)
  maxDrawdownPct: number; // repli max toléré depuis le plus haut (0..1)
  requireStop: boolean;
}

export const DEFAULT_LIMITS: Limits = {
  maxPositionPct: 0.5,
  maxRiskPerTradePct: 0.01,
  maxDrawdownPct: 0.2,
  requireStop: true,
};
