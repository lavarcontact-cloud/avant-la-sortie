import Link from "next/link";
import { Icon } from "./icons";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:mb-9 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.025em] text-zinc-900 sm:text-[2.35rem]">{title}</h1>
        {subtitle && <div className="mt-2.5 max-w-3xl text-[0.9rem] leading-relaxed text-zinc-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 xl:shrink-0">{actions}</div>}
    </header>
  );
}

export function Card({ title, action, children, className = "", pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pb-1 pt-4">
          <h2 className="font-display text-[1.02rem] font-semibold tracking-[-0.01em] text-zinc-900">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5 pt-3" : "pt-2"}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, delta, hint, tone = "default", href }: { label: string; value: React.ReactNode; delta?: number | null; hint?: string; tone?: "default" | "accent" | "green" | "red" | "muted"; href?: string }) {
  const toneCls = { default: "text-zinc-900", accent: "text-accent", green: "text-emerald-700", red: "text-red-600", muted: "text-zinc-500" }[tone];
  const body = (
    <div className={`card h-full px-4 py-4 sm:px-5 ${href ? "card-lift" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[0.74rem] font-medium leading-tight text-zinc-500">{label}</div>
        {href && <Icon name="arrow" size={14} className="mt-0.5 text-zinc-300" />}
      </div>
      <div className={`mt-2 font-display text-[1.7rem] font-semibold leading-none tracking-[-0.02em] tabular sm:text-[1.9rem] ${toneCls}`}>{value}</div>
      <div className="mt-2 flex min-h-[1rem] flex-wrap items-center gap-x-2 text-[0.72rem]">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium ${delta > 0 ? "bg-emerald-50 text-emerald-700" : delta < 0 ? "bg-red-50 text-red-700" : "text-zinc-400"}`}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "="} {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
        {hint && <span className="text-zinc-400">{hint}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

const TONES: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  accent: "bg-accent-soft text-accent-deep ring-[#ffcfc2]",
  dark: "bg-zinc-900 text-zinc-50 ring-zinc-900",
};
export function Badge({ tone = "slate", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-[0.15rem] text-[0.68rem] font-medium ring-1 ring-inset ${TONES[tone] ?? TONES.slate}`}>{children}</span>;
}

export function Empty({ title, children, action, icon = "sparkle" }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-zinc-300 bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(23,21,19,.015)_10px,rgba(23,21,19,.015)_20px)] px-6 py-12 text-center">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-zinc-900 text-accent"><Icon name={icon} size={20} /></div>
      <div className="font-display text-[1.05rem] font-semibold text-zinc-800">{title}</div>
      {children && <div className="mt-1.5 max-w-md text-sm leading-relaxed text-zinc-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Bar({ value, max, color = "#171513", label }: { value: number; max: number; color?: string; label?: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100"><div className="bar-grow h-full rounded-full" style={{ width: `${w}%`, background: color }} /></div>
      {label !== undefined && <span className="w-16 text-right text-xs tabular text-zinc-600">{label}</span>}
    </div>
  );
}

export const pctLabel = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)} %`);

export function stageTone(kind?: string | null) {
  return kind === "won" ? "green" : kind === "lost" ? "red" : kind === "dnc" ? "dark" : "slate";
}

export const docTone = (s: string) => ({ draft: "slate", sent: "blue", accepted: "violet", paid: "green", partially_paid: "amber", overdue: "red", cancelled: "dark" } as Record<string, string>)[s] ?? "slate";

/** Titre de section discret (repère mono) — sert à rythmer les longues pages. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-9 flex items-center gap-3 first:mt-0"><span className="eyebrow">{children}</span><span className="h-px flex-1 bg-zinc-200" /></div>;
}
