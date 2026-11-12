// Graphique en lignes à trois scénarios (SVG pur, rendu serveur).
export interface Series { label: string; color: string; values: number[]; dashed?: boolean }

export function ScenarioChart({ labels, series, unit = "€", height = 200, empty }: { labels: string[]; series: Series[]; unit?: string; height?: number; empty?: string }) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(0, ...all);
  if (!all.length || max === 0) return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-center text-xs text-zinc-500">{empty ?? "Pas encore de données à projeter"}</div>;
  const W = 560, H = height, L = 52, R = 10, T = 10, B = 26;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (1 - v / (max * 1.1)) * (H - T - B);
  const fmt = (v: number) => (unit === "€" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, notation: v >= 10000 ? "compact" : "standard" }).format(v));
  const ticks = [0, 0.5, 1].map((f) => f * max * 1.1);
  const band = series.length >= 3 ? `M ${series[2].values.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${[...series[0].values].map((v, i) => [i, v] as const).reverse().map(([i, v]) => `${x(i)},${y(v)}`).join(" L ")} Z` : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {ticks.map((tv, i) => <g key={i}><line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="#f1f1f3" /><text x={L - 6} y={y(tv) + 3} textAnchor="end" fontSize="9" fill="#a1a1aa">{fmt(tv)}</text></g>)}
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#71717a">{l}</text>)}
        {band && <path d={band} fill="#ff5b3c" opacity="0.08" />}
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.2} strokeDasharray={s.dashed ? "4 3" : undefined} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={s.dashed ? 0 : 2.5} fill={s.color}><title>{`${s.label} · ${labels[i]} : ${fmt(v)}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[0.7rem] text-zinc-500">{series.map((s) => <span key={s.label} className="flex items-center gap-1"><span className="h-0.5 w-4" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export const SCENARIO_COLORS = { prudent: "#a1a1aa", central: "#ff5b3c", ambitious: "#18181b" } as const;
