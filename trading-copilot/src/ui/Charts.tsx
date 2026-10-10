// Graphiques basés sur lightweight-charts (TradingView, licence Apache 2.0 — attribution affichée).
import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, type IChartApi, type UTCTimestamp, type SeriesMarker, type Time } from 'lightweight-charts';
import type { Candle, Fill } from '../engine/types';
import { sma } from '../engine/indicators';

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const ts = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

function baseChart(el: HTMLElement): IChartApi {
  return createChart(el, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: css('--muted'), fontFamily: css('--mono'), fontSize: 11, attributionLogo: true },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    rightPriceScale: { borderColor: css('--line') },
    timeScale: { borderColor: css('--line'), timeVisible: false },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { locale: 'fr-FR', priceFormatter: (p: number) => p.toLocaleString('fr-FR', { maximumFractionDigits: p < 10 ? 4 : 0 }) },
  });
}

export function PriceChart({ candles, partial, fills = [], height = 320, label }: { candles: Candle[]; partial?: Candle; fills?: Fill[]; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !candles.length) return;
    const chart = baseChart(ref.current);
    const gain = css('--gain'), loss = css('--loss');
    const s = chart.addCandlestickSeries({ upColor: gain, downColor: loss, borderVisible: false, wickUpColor: gain, wickDownColor: loss });
    const all = partial ? [...candles, partial] : candles;
    s.setData(all.map((c) => ({ time: ts(c.t), open: c.o, high: c.h, low: c.l, close: c.c })));
    const ma = sma(candles.map((c) => c.c), 50);
    const line = chart.addLineSeries({ color: css('--info'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    line.setData(candles.flatMap((c, i) => (Number.isFinite(ma[i]) ? [{ time: ts(c.t), value: ma[i] }] : [])));
    const vol = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, color: 'rgba(125,132,150,0.35)', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(all.map((c) => ({ time: ts(c.t), value: c.v })));
    const day = (ms: number) => ts(Math.floor(ms / 86_400_000) * 86_400_000);
    const markers: SeriesMarker<Time>[] = fills.map((f) => ({
      time: day(f.at), position: f.side === 'buy' ? 'belowBar' : 'aboveBar', color: f.side === 'buy' ? gain : loss,
      shape: f.side === 'buy' ? 'arrowUp' : 'arrowDown', text: f.side === 'buy' ? 'A' : 'V',
    }));
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    s.setMarkers(markers);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, partial, fills]);
  return <div ref={ref} className="chart" style={{ height }} role="img" aria-label={label} />;
}

export interface Line { label: string; color: string; points: { t: number; v: number }[]; dashed?: boolean }

export function LinesChart({ lines, height = 240, label }: { lines: Line[]; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = baseChart(ref.current);
    chart.applyOptions({ timeScale: { timeVisible: true } });
    for (const l of lines) {
      const s = chart.addLineSeries({ color: l.color, lineWidth: 2, lineStyle: l.dashed ? 2 : 0, priceLineVisible: false, title: l.label });
      const seen = new Map<number, number>();
      for (const p of l.points) seen.set(ts(p.t), p.v); // une valeur par seconde, triée
      s.setData([...seen.entries()].sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time: time as UTCTimestamp, value })));
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines]);
  return <div ref={ref} className="chart" style={{ height }} role="img" aria-label={label} />;
}
