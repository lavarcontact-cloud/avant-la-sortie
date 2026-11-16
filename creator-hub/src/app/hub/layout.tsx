import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { unreadCount } from "@/lib/data";
import { q } from "@/lib/db";
import { logout } from "../login/actions";
import { NavLink, MobileNav } from "./nav-link";
import { TableCards } from "./table-cards";
import { NAV } from "./nav";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const [notifs, fu, inbound, watchNew] = await Promise.all([
    unreadCount(),
    q<{ c: number }>(`select count(*)::int c from outreach o join brands b on b.id=o.brand_id left join pipeline_stages s on s.id=b.stage_id
      where o.follow_up_done=false and o.follow_up_at <= (now() at time zone 'Europe/Paris')::date and b.do_not_contact=false and coalesce(s.kind,'open')='open'
      and not exists (select 1 from responses r where r.outreach_id=o.id)`),
    q<{ c: number }>(`select count(*)::int c from inbound_requests where handled=false`),
    q<{ c: number }>(`select count(*)::int c from watch_candidates where kind='brand' and status='new'`),
  ]);
  const counts: Record<string, number> = { notifs, followups: fu[0]?.c ?? 0, watch: watchNew[0]?.c ?? 0 };
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-ink px-3 pb-4 text-zinc-300 lg:flex">
        <Link href="/hub" className="flex items-center gap-2.5 px-3 pb-6 pt-6">
          <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-accent"><span className="h-3 w-3 rounded-full border-2 border-ink" /></span>
          <span className="leading-tight"><span className="block font-display text-[0.95rem] font-semibold text-white">Business & PR Hub</span><span className="eyebrow !text-[0.58rem] !text-zinc-500">Studio commercial</span></span>
        </Link>
        <form action="/hub/search" className="mb-5 px-1">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-400 transition focus-within:border-accent/70">
            <Icon name="search" size={15} /><input name="q" placeholder="Rechercher…" className="w-full bg-transparent text-[0.82rem] text-white outline-none placeholder:text-zinc-500" />
          </label>
        </form>
        <nav className="flex-1 space-y-5">
          {groups.map((g) => (
            <div key={g}>
              <div className="eyebrow mb-1.5 px-3 !text-[0.58rem] !text-zinc-600">{g}</div>
              <div className="space-y-0.5">{NAV.filter((n) => n.group === g).map((n) => <NavLink key={n.href} href={n.href} icon={n.icon} label={n.label} count={"countKey" in n ? counts[n.countKey] : 0} />)}</div>
            </div>
          ))}
        </nav>
        <div className="mt-6 space-y-3 px-1">
          <Link href="/hub/brands/new" className="btn btn-accent w-full"><Icon name="plus" size={16} />Ajouter une marque</Link>
          {inbound[0]?.c > 0 && <Link href="/hub/notifications" className="block rounded-xl bg-accent/15 px-3 py-2 text-xs text-[#ffb8a6]">{inbound[0].c} demande(s) entrante(s) à traiter</Link>}
          <div className="flex items-center justify-between border-t border-white/10 px-2 pt-3 text-xs text-zinc-500">
            <Link href="/" target="_blank" className="inline-flex items-center gap-1.5 hover:text-white"><Icon name="external" size={13} />Site public</Link>
            <form action={logout}><button className="inline-flex items-center gap-1.5 hover:text-white"><Icon name="logout" size={13} />Quitter</button></form>
          </div>
        </div>
      </aside>

      {/* Navigation mobile / tablette */}
      <MobileNav counts={counts} inbound={inbound[0]?.c ?? 0} logout={logout} />

      <main className="min-w-0 px-4 pb-28 pt-5 sm:px-6 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[1360px]">{children}</div>
      </main>
      <TableCards />
    </div>
  );
}
