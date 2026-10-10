"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/client";
import { ManageCookiesButton } from "./consent";

const NAV = [
  { href: "/", label: "Profil", icon: IconProfile },
  { href: "/flux", label: "Flux", icon: IconPlay },
  { href: "/artistes", label: "Artistes", icon: IconOrbit },
  { href: "/projets", label: "Travaux", icon: IconGrid },
  { href: "/prestations", label: "Prestations", icon: IconSpark },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Dock flottant : la barre d'onglets d'une app native sur mobile, un
 * "ornement" centré sur desktop. En verre parce qu'il flotte au-dessus des
 * vidéos plein écran du flux.
 */
export function Dock() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <nav
      aria-label="Navigation principale"
      className="glass fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full px-2"
      style={{ bottom: "calc(12px + var(--safe-b))", height: "var(--dock-h)" }}
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-12 min-w-[56px] flex-col items-center justify-center rounded-full px-2 text-[10.5px] font-medium transition-colors sm:min-w-[72px] ${
              active ? "text-[var(--color-fg)]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            <Icon active={active} />
            <span className="mt-0.5">{label}</span>
            {active && <span aria-hidden className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[var(--color-accent)]" />}
          </Link>
        );
      })}
    </nav>
  );
}

/** En-tête : signature, timecode (hérité d'"Avant la sortie") et CTA devis. */
export function TopBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  const onFeed = pathname.startsWith("/flux");
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] sm:px-6">
      <Link
        href="/"
        className={`pointer-events-auto t-display text-[17px] tracking-tight ${onFeed ? "glass rounded-full px-3 py-1.5" : ""}`}
      >
        Sébastien Fula-Pitu<span className="text-[var(--color-accent)]">.</span>
      </Link>
      <div className="pointer-events-auto flex items-center gap-3">
        <Timecode />
        <Link
          href="/devis"
          className="btn btn-primary !min-h-[38px] !px-4 text-sm"
          onClick={() => track("cta_click", { cta: "devis", surface: "topbar" })}
        >
          Devis
        </Link>
      </div>
    </header>
  );
}

/**
 * Timecode : avance avec le défilement de la page (métaphore du montage
 * continu). Purement décoratif, donc masqué aux technologies d'assistance.
 */
function Timecode() {
  const [tc, setTc] = useState("00:00:00:00");
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const frames = Math.round((scrollY / max) * 6 * 60 * 25); // montage nominal de 6 min à 25 i/s
      const f = frames % 25;
      const s = Math.floor(frames / 25) % 60;
      const m = Math.floor(frames / 1500);
      setTc(`00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    addEventListener("scroll", on, { passive: true });
    update();
    return () => removeEventListener("scroll", on);
  }, []);
  return (
    <span aria-hidden className="t-mono hidden items-center gap-2 text-[12px] text-[var(--color-muted)] sm:flex">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
      {tc}
    </span>
  );
}

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/flux")) return null;
  return (
    <footer className="border-t border-[var(--color-line)] px-5 pb-[calc(var(--dock-h)+var(--safe-b)+40px)] pt-10 text-sm text-[var(--color-muted)] sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="t-display text-lg text-[var(--color-fg)]">Sébastien Fula-Pitu</p>
          <p className="mt-1">Réalisation, photographie, montage.</p>
        </div>
        <nav aria-label="Liens secondaires" className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          <Link href="/a-propos" className="hover:text-[var(--color-fg)]">À propos</Link>
          <Link href="/photo" className="hover:text-[var(--color-fg)]">Photo</Link>
          <Link href="/contact" className="hover:text-[var(--color-fg)]">Contact</Link>
          <Link href="/mentions-legales" className="hover:text-[var(--color-fg)]">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-[var(--color-fg)]">Confidentialité</Link>
          <Link href="/cgv" className="hover:text-[var(--color-fg)]">CGV</Link>
          <Link href="/retractation" className="hover:text-[var(--color-fg)]">Se rétracter</Link>
          <ManageCookiesButton className="text-left hover:text-[var(--color-fg)]" />
        </nav>
      </div>
    </footer>
  );
}

/* ---------- Icônes (SVG inline, 22px, trait 1.8) ---------- */
type IP = { active?: boolean };
const sv = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function IconProfile({ active }: IP) {
  return <svg {...sv}><circle cx="12" cy="8.5" r="3.5" fill={active ? "currentColor" : "none"} /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></svg>;
}
function IconPlay({ active }: IP) {
  return <svg {...sv}><rect x="5" y="3" width="14" height="18" rx="3.5" /><path d="M10.5 9.2v5.6l4.4-2.8z" fill={active ? "currentColor" : "none"} /></svg>;
}
function IconOrbit({ active }: IP) {
  return <svg {...sv}><circle cx="12" cy="12" r="3.2" fill={active ? "currentColor" : "none"} /><circle cx="5" cy="7" r="1.8" /><circle cx="19" cy="6" r="1.4" /><circle cx="18" cy="18" r="2" /><circle cx="6" cy="18" r="1.4" /></svg>;
}
function IconGrid({ active }: IP) {
  const f = active ? "currentColor" : "none";
  return <svg {...sv}><rect x="4" y="4" width="7" height="7" rx="1.8" fill={f} /><rect x="13" y="4" width="7" height="7" rx="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.8" fill={f} /></svg>;
}
function IconSpark({ active }: IP) {
  return <svg {...sv}><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" fill={active ? "currentColor" : "none"} /></svg>;
}
