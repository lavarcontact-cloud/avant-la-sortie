import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { PriceChart } from '../ui/Charts';
import type { AssetId } from '../engine/types';
import { estimateOrder, valuate, availableQty, type OrderDraft } from '../engine/ledger';
import { checkLimits, positionSize } from '../engine/risk';
import { realizedVol, rsi, sma, donchian } from '../engine/indicators';
import { eur, pc, qty, dt } from '../ui/fmt';

export default function Market() {
  const { view, p } = useApp();
  const [asset, setAsset] = useState<AssetId>(p.profile.followed[0] ?? 'BTC');
  const s = view.series[asset];
  const c = s.candles;
  const fills = useMemo(() => view.ledger.fills.filter((f) => f.asset === asset), [view.ledger.fills, asset]);
  const stats = useMemo(() => {
    const closes = c.map((x) => x.c);
    const n = c.length;
    if (n < 60) return null;
    const dc = donchian(c, 20);
    return { last: c[n - 1], r1: c[n - 1].c / c[n - 2].c - 1, r30: c[n - 1].c / c[n - 31].c - 1, vol30: realizedVol(closes, 30), rsi: rsi(closes)[n - 1], sma50: sma(closes, 50)[n - 1], hi20: dc.upper[n - 1], lo20: dc.lower[n - 1] };
  }, [c]);
  const q = view.quotes[asset];

  return (
    <div className="screen">
      <div className="row between">
        <div className="seg" role="group" aria-label="Actif">
          {(['BTC', 'ETH'] as AssetId[]).map((a) => <button key={a} aria-pressed={asset === a} onClick={() => setAsset(a)}>{a}/EUR</button>)}
        </div>
        <span className="hint">{q ? `Cotation ${eur(q.last)} · ${dt(q.at)}` : `Dernière clôture · ${s.source}`}</span>
      </div>
      <div className="grid-2 wide-left">
        <section className="card">
          <div className="card-head">
            <span className="h2">{asset}/EUR · journalier</span>
            <span className="hint">Bougies {s.kind === 'snapshot' ? 'du snapshot' : 'temps réel'} · moyenne 50 j en bleu · A/V = tes exécutions</span>
          </div>
          <PriceChart candles={c} partial={s.partial} fills={fills} label={`Graphique en chandeliers ${asset}/EUR`} />
          {s.partial && <p className="hint">La dernière bougie (séance en cours) est provisoire et exclue des indicateurs.</p>}
          {stats && (
            <div className="grid-3" style={{ marginTop: 12 }}>
              <Stat l="Dernière clôture" v={eur(stats.last.c, 0)} />
              <Stat l="Séance" v={pc(stats.r1)} tone={stats.r1} />
              <Stat l="30 jours" v={pc(stats.r30)} tone={stats.r30} />
              <Stat l="Volatilité 30 j (ann.)" v={`${(stats.vol30 * 100).toFixed(0)} %`} />
              <Stat l="Canal 20 j" v={`${eur(stats.lo20, 0)} – ${eur(stats.hi20, 0)}`} />
              <Stat l="RSI 14" v={stats.rsi.toFixed(0)} />
            </div>
          )}
          <p className="legal" style={{ marginTop: 10 }}>Les indicateurs décrivent le passé. Aucun n'est une preuve de rentabilité future.</p>
        </section>
        <OrderTicket asset={asset} lo20={stats?.lo20} />
      </div>
      <OpenOrders />
    </div>
  );
}

function Stat({ l, v, tone }: { l: string; v: string; tone?: number }) {
  return <div className="kpi"><span className="label">{l}</span><span className={`value ${tone === undefined ? '' : tone >= 0 ? 'gain' : 'loss'}`} style={{ fontSize: 16 }}>{v}</span></div>;
}

function OrderTicket({ asset, lo20 }: { asset: AssetId; lo20?: number }) {
  const { view, place, p } = useApp();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState('');
  const [stop, setStop] = useState('');
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msgs: string[] } | null>(null);
  const quote = view.quotes[asset];
  const num = (x: string) => (x.trim() === '' ? undefined : Number(x.replace(',', '.')));
  const draft: OrderDraft = { asset, side, type, qty: num(q) ?? 0, limitPrice: type === 'limit' ? num(limit) : undefined, stopPrice: side === 'buy' ? num(stop) : undefined };
  const est = quote && draft.qty > 0 ? estimateOrder(view.ledger, draft, quote) : null;
  const checks = est ? checkLimits(view.ledger, draft, est.price, view.marks, p.limits, view.peak) : [];
  const v = valuate(view.ledger, view.marks);

  const sizeFromRisk = () => {
    const entry = (type === 'limit' && num(limit)) || quote?.last;
    const st = num(stop) ?? (lo20 && entry && lo20 < entry ? Math.round(lo20) : undefined);
    if (!entry || !st) { setResult({ ok: false, msgs: ['Indique un stop inférieur au prix d\'entrée pour calculer la taille.'] }); return; }
    const r = positionSize({ equity: v.equity, riskPct: p.limits.maxRiskPerTradePct, entry, stop: st, feeRate: view.ledger.execution.feeRate, maxCash: v.availableCash });
    setStop(String(st));
    setQ(String(r.qty));
    setResult({ ok: true, msgs: [`Taille calculée : perte au stop ≈ ${eur(r.riskAmount ?? 0)} (${(p.limits.maxRiskPerTradePct * 100).toFixed(1)} % du capital), frais inclus, sans gap.${r.capped ? ' Plafonnée par tes liquidités.' : ''}`] });
  };

  const submit = () => {
    const r = place(draft);
    if (r.ok) { setResult({ ok: true, msgs: [type === 'market' ? 'Ordre simulé exécuté.' : 'Ordre limite simulé enregistré : il s\'exécutera si le prix est atteint.'] }); setQ(''); setAck(false); }
    else setResult({ ok: false, msgs: r.errors });
  };

  return (
    <section className="card" aria-labelledby="ticket">
      <div className="card-head"><span id="ticket" className="h2">Ordre simulé</span><span className="chip sim">Argent fictif</span></div>
      {!view.canTrade && <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>{view.tradeBlock}</div>}
      <div className="grid" style={{ gap: 12 }}>
        <div className="row">
          <div className="seg" role="group" aria-label="Sens">
            <button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Acheter</button>
            <button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Vendre</button>
          </div>
          <div className="seg" role="group" aria-label="Type d'ordre">
            <button aria-pressed={type === 'market'} onClick={() => setType('market')}>Au marché</button>
            <button aria-pressed={type === 'limit'} onClick={() => setType('limit')}>Limite</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="qty">Quantité ({asset})</label>
          <input id="qty" className="input" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="0,01" />
          <span className="hint">{side === 'sell' ? `Disponible : ${qty(availableQty(view.ledger, asset))} ${asset}` : `Liquidités disponibles : ${eur(v.availableCash)}`}</span>
        </div>
        {type === 'limit' && (
          <div className="field">
            <label htmlFor="limit">Prix limite (€)</label>
            <input id="limit" className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <span className="hint">Achat : exécuté si le prix descend à ce niveau. Vente : s'il monte à ce niveau.</span>
          </div>
        )}
        {side === 'buy' && (
          <div className="field">
            <label htmlFor="stop">Stop d'invalidation (€) — recommandé</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id="stop" className="input" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} placeholder={lo20 ? `ex. plus bas 20 j : ${Math.round(lo20)}` : ''} />
              <button type="button" className="btn sm" onClick={sizeFromRisk} style={{ whiteSpace: 'nowrap' }}>Taille selon mon risque</button>
            </div>
            <span className="hint">Le niveau où ton idée est fausse. Sert au calcul du risque et au bilan. (Le stop n'est pas exécuté automatiquement dans cette version.)</span>
          </div>
        )}
        {est && (
          <dl className="grid-3" style={{ margin: 0 }} aria-label="Estimation">
            <div className="kpi"><dt className="label">Prix estimé</dt><dd className="value" style={{ margin: 0, fontSize: 15 }}>{eur(est.price)}</dd></div>
            <div className="kpi"><dt className="label">Frais ({(view.ledger.execution.feeRate * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} %)</dt><dd className="value" style={{ margin: 0, fontSize: 15 }}>{eur(est.fee)}</dd></div>
            <div className="kpi"><dt className="label">Spread + glissement</dt><dd className="value" style={{ margin: 0, fontSize: 15 }}>{eur(est.implicit)}</dd></div>
            <div className="kpi"><dt className="label">{side === 'buy' ? 'Total débité' : 'Total crédité'}</dt><dd className="value" style={{ margin: 0, fontSize: 15 }}>{eur(Math.abs(est.totalCashOut))}</dd></div>
            <div className="kpi"><dt className="label">Part du capital</dt><dd className="value" style={{ margin: 0, fontSize: 15 }}>{pc(est.notional / v.equity, 1).replace('+', '')}</dd></div>
          </dl>
        )}
        {checks.length > 0 && (
          <div className="notice warn" role="alert">
            <div>
              <strong>Le risque dépasse une limite que tu as définie.</strong>
              <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{checks.map((c) => <li key={c.rule}>{c.message}</li>)}</ul>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />J'ai lu et je maintiens cet ordre simulé</label>
            </div>
          </div>
        )}
        <button className={`btn ${side}`} disabled={!view.canTrade || !(draft.qty > 0) || (checks.length > 0 && !ack)} onClick={submit}>
          {side === 'buy' ? 'Simuler l\'achat' : 'Simuler la vente'}
        </button>
        {result && <div className={`notice ${result.ok ? '' : 'err'}`} role="status">{result.msgs.join(' ')}</div>}
        <p className="legal" style={{ margin: 0 }}>Exécution simulée : {view.quotes[asset]?.source ?? 'aucune cotation'}. Hypothèses : frais {(view.ledger.execution.feeRate * 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} %, spread {view.ledger.execution.spreadBps} pb (si bid/ask inconnus), glissement {view.ledger.execution.slippageBps} pb. Pas de levier, pas de vente à découvert.</p>
      </div>
    </section>
  );
}

function OpenOrders() {
  const { view, cancel } = useApp();
  const orders = view.ledger.openOrders;
  if (!orders.length) return null;
  return (
    <section className="card">
      <div className="card-head"><span className="h2">Ordres limite en attente</span></div>
      <div className="scroll-x"><table className="table">
        <thead><tr><th>Sens</th><th>Actif</th><th className="r">Qté</th><th className="r">Limite</th><th></th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id}><td>{o.side === 'buy' ? 'Achat' : 'Vente'}</td><td>{o.asset}</td><td className="r num">{qty(o.qty)}</td><td className="r num">{eur(o.limitPrice ?? 0)}</td>
            <td className="r"><button className="btn sm ghost" onClick={() => cancel(o.id)}>Annuler</button></td></tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}
