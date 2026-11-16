// Graphique en lignes à trois scénarios (SVG pur, rendu serveur).
export interface Series { label: string; color: string; values: number[]; dashed?: boolean }

export function ScenarioChart({ labels, series, unit = "€", height = 200, empty }: { labels: string[]; series: Series[]; unit?: string; height?: number; empty?: string }) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(0, ...all);
  if (!all.length || max === 0) return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 px-6 text-center text-xs leading-relaxed text-zinc-500">{empty ?? "Pas encore de données à projeter"}</div>;
  const W = 560, H = height, L = 64, R = 12, T = 12, B = 30;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (1 - v / (max * 1.1)) * (H - T - B);
  const fmt = (v: number) => (unit === "€" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, notation: v >= 10000 ? "compact" : "standard" }).format(v));
  const ticks = [0, 0.5, 1].map((f) => f * max * 1.1);
  const band = series.length >= 3 ? `M ${series[2].values.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${[...series[0].values].map((v, i) => [i, v] as const).reverse().map(([i, v]) => `${x(i)},${y(v)}`).join(" L ")} Z` : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {ticks.map((tv, i) => <g key={i}><line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="#ebe6dc" strokeDasharray={i === 0 ? undefined : "2 4"} /><text x={L - 6} y={y(tv) + 3} textAnchor="end" fontSize="12" fill="#a59c8d" fontFamily="var(--font-mono)">{fmt(tv)}</text></g>)}
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#7a7266" fontFamily="var(--font-mono)">{l}</text>)}
        {band && <path className="chart-fade" d={band} fill="#ff5b3c" fillOpacity={0.1} stroke="none" />}
        {series.map((s) => (
          <g key={s.label}>
            {s.dashed
              ? <polyline className="chart-fade" fill="none" stroke={s.color} strokeWidth={1.5} strokeDasharray="4 3" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
              : <polyline className="chart-line" pathLength={1} style={{ ["--len" as string]: 1 } as React.CSSProperties} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />}
            {s.values.map((v, i) => <circle key={i} className="chart-fade" cx={x(i)} cy={y(v)} r={s.dashed ? 0 : 3} fill="#fffdf9" stroke={s.color} strokeWidth={2}><title>{`${s.label} · ${labels[i]} : ${fmt(v)}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[0.7rem] text-zinc-500">{series.map((s) => <span key={s.label} className="flex items-center gap-1"><span className="h-0.5 w-4" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export const SCENARIO_COLORS = { prudent: "#a59c8d", central: "#ff5b3c", ambitious: "#171513" } as const;
