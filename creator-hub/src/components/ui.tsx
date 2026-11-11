import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "", pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, delta, hint, tone = "default", href }: { label: string; value: React.ReactNode; delta?: number | null; hint?: string; tone?: "default" | "accent" | "green" | "red" | "muted"; href?: string }) {
  const toneCls = { default: "text-zinc-900", accent: "text-accent", green: "text-emerald-600", red: "text-red-600", muted: "text-zinc-500" }[tone];
  const body = (
    <div className="card h-full p-4 transition hover:border-zinc-300">
      <div className="text-[0.72rem] font-medium text-zinc-500">{label}</div>
      <div className={`mt-1.5 font-display text-2xl font-semibold tabular ${toneCls}`}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && (
          <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-zinc-400"}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
        {hint && <span className="text-zinc-400">{hint}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const TONES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  accent: "bg-accent-soft text-[#c2381d] ring-orange-200",
  dark: "bg-zinc-900 text-white ring-zinc-900",
};
export function Badge({ tone = "slate", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${TONES[tone] ?? TONES.slate}`}>{children}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-10 text-center">
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-zinc-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Bar({ value, max, color = "#18181b", label }: { value: number; max: number; color?: string; label?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} /></div>
      {label !== undefined && <span className="w-16 text-right text-xs tabular text-zinc-600">{label}</span>}
    </div>
  );
}

export const pctLabel = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)} %`);

export function stageTone(kind?: string | null) {
  return kind === "won" ? "green" : kind === "lost" ? "red" : kind === "dnc" ? "dark" : "slate";
}

export const docTone = (s: string) => ({ draft: "slate", sent: "blue", accepted: "violet", paid: "green", partially_paid: "amber", overdue: "red", cancelled: "dark" } as Record<string, string>)[s] ?? "slate";
