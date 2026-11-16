"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { NAV, MOBILE_TABS } from "./nav";

const isActive = (path: string, href: string) => (href === "/hub" ? path === "/hub" : path.startsWith(href));

export function NavLink({ href, label, icon, count }: { href: string; label: string; icon: string; count?: number }) {
  const path = usePathname();
  const active = isActive(path, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.85rem] transition-colors duration-200 ${active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}>
      <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${active ? "opacity-100" : "scale-y-0 opacity-0"}`} />
      <Icon name={icon} size={17} className={`transition-colors ${active ? "text-accent" : "text-zinc-500 group-hover:text-zinc-300"}`} />
      <span className="truncate">{label}</span>
      {count ? <span className="ml-auto rounded-full bg-accent px-1.5 text-[0.65rem] font-semibold leading-[1.15rem] text-white tabular">{count}</span> : null}
    </Link>
  );
}

export function MobileNav({ counts, inbound, logout }: { counts: Record<string, number>; inbound: number; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  const current = NAV.find((n) => isActive(path, n.href));
  const tabs = MOBILE_TABS.map((h) => NAV.find((n) => n.href === h)!);
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-zinc-200/80 bg-canvas/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/hub" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-ink"><span className="h-3 w-3 rounded-full border-2 border-accent" /></span>
          <span className="truncate font-display text-[0.98rem] font-semibold">{current?.label ?? "Business & PR Hub"}</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link href="/hub/search" aria-label="Rechercher" className="grid h-10 w-10 place-items-center rounded-full text-zinc-700 hover:bg-zinc-100"><Icon name="search" size={19} /></Link>
          <Link href="/hub/brands/new" aria-label="Ajouter une marque" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white"><Icon name="plus" size={19} /></Link>
        </div>
      </header>

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-[#fffdf9]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((t) => {
            const a = isActive(path, t.href);
            const c = "countKey" in t ? counts[t.countKey] : 0;
            return (
              <Link key={t.href} href={t.href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition-colors ${a ? "text-zinc-900" : "text-zinc-500"}`}>
                <span className={`relative grid h-7 w-12 place-items-center rounded-full transition-colors duration-300 ${a ? "bg-zinc-900 text-accent" : ""}`}><Icon name={t.icon} size={19} />
                  {c ? <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-accent px-1 text-[0.58rem] leading-4 text-white">{c}</span> : null}</span>
                {t.label === "Business Forecast" ? "Forecast" : t.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium text-zinc-500">
            <span className="relative grid h-7 w-12 place-items-center rounded-full"><Icon name="menu" size={19} />{counts.notifs ? <span className="absolute right-2 top-0 h-2 w-2 rounded-full bg-accent" /> : null}</span>Plus
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Fermer" className="absolute inset-0 bg-ink/40 backdrop-blur-sm [animation:fade_.25s_both]" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem] bg-ink px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-zinc-300 [animation:toast-in_.4s_var(--ease-out-expo)_both]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {NAV.map((n) => {
                const a = isActive(path, n.href); const c = "countKey" in n ? counts[n.countKey] : 0;
                return (
                  <Link key={n.href} href={n.href} className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center text-[0.72rem] leading-tight transition ${a ? "bg-white/10 text-white" : "bg-white/[0.03] hover:bg-white/[0.07]"}`}>
                    <Icon name={n.icon} size={21} className={a ? "text-accent" : "text-zinc-400"} />{n.label}
                    {c ? <span className="absolute right-2 top-2 rounded-full bg-accent px-1.5 text-[0.6rem] leading-4 text-white">{c}</span> : null}
                  </Link>
                );
              })}
            </div>
            {inbound > 0 && <Link href="/hub/notifications" className="mt-3 block rounded-2xl bg-accent/15 px-4 py-3 text-sm text-[#ffb8a6]">{inbound} demande(s) entrante(s) à traiter</Link>}
            <div className="mt-4 flex items-center justify-between border-t border-white/10 px-1 pt-4 text-sm">
              <Link href="/" className="inline-flex items-center gap-2 text-zinc-400"><Icon name="external" size={15} />Site public</Link>
              <form action={logout}><button className="inline-flex items-center gap-2 text-zinc-400"><Icon name="logout" size={15} />Se déconnecter</button></form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
