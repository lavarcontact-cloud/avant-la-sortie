export const TZ = "Europe/Paris";

/** Composantes de date/heure dans le fuseau Europe/Paris. */
export function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday); // 0 = lundi
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: wd, ymd: `${p.year}-${p.month}-${p.day}` };
}

export function todayParis(): string { return parisParts(new Date()).ymd; }

export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(v: string | Date | null | undefined) {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v.length === 10 ? v + "T12:00:00Z" : v) : v;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(d);
}
export function fmtDateTime(v: string | Date | null | undefined) {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}
/** Date (Date ou chaîne) → "YYYY-MM-DD". */
export function ymd(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const TIME_SLOTS = [
  { key: "early", label: "6h-9h", from: 6, to: 9 },
  { key: "morning", label: "9h-12h", from: 9, to: 12 },
  { key: "lunch", label: "12h-14h", from: 12, to: 14 },
  { key: "afternoon", label: "14h-18h", from: 14, to: 18 },
  { key: "evening", label: "18h-22h", from: 18, to: 22 },
  { key: "night", label: "22h-6h", from: 22, to: 30 },
];
export function slotOf(hour: number) {
  return TIME_SLOTS.find((s) => (hour >= s.from && hour < s.to) || (s.key === "night" && (hour >= 22 || hour < 6)))!.key;
}

/** Timestamp (ms) de minuit heure de Paris pour une date "YYYY-MM-DD" (gère l'heure d'été). */
export function parisMidnight(ymdStr: string): number {
  const guess = Date.parse(ymdStr + "T00:00:00Z");
  const offsetH = parisParts(new Date(guess)).hour; // 1 en hiver, 2 en été
  return guess - offsetH * 3600000;
}

/** Date (objet Date du driver ou chaîne) → "YYYY-MM-DD…" fiable pour les comparaisons par jour / mois. */
export function iso(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString();
  return v;
}
