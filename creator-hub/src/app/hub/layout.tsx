import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { unreadCount } from "@/lib/data";
import { q } from "@/lib/db";
import { logout } from "../login/actions";
import { NavLink } from "./nav-link";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const NAV = [
  { href: "/hub", label: "Dashboard", icon: "◧" },
  { href: "/hub/watch", label: "Veille", icon: "✦", countKey: "watch" },
  { href: "/hub/forecast", label: "Business Forecast", icon: "↗" },
  { href: "/hub/audience", label: "Audience Value", icon: "◉" },
  { href: "/hub/brands", label: "Marques · CRM", icon: "◎" },
  { href: "/hub/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/hub/followups", label: "Relances", icon: "↻", countKey: "followups" },
  { href: "/hub/responses", label: "Réponses", icon: "✉" },
  { href: "/hub/contacts", label: "Interlocuteurs", icon: "◌" },
  { href: "/hub/finance", label: "Finances", icon: "€" },
  { href: "/hub/documents", label: "Devis & factures", icon: "▭" },
  { href: "/hub/notifications", label: "Notifications", icon: "●", countKey: "notifs" },
  { href: "/hub/reports", label: "Bilans", icon: "◷" },
  { href: "/hub/settings", label: "Paramètres", icon: "⚙" },
];

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
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 z-30 border-b border-zinc-200 bg-white lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:py-5">
          <Link href="/hub" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900"><span className="h-3 w-3 rounded-full border-2 border-accent" /></span>
            <span className="text-sm font-semibold tracking-tight">Business & PR Hub</span>
          </Link>
          <Link href="/hub/brands/new" className="btn btn-accent !px-2.5 !py-1 lg:hidden">+ Marque</Link>
        </div>
        <form action="/hub/search" className="hidden px-3 pb-3 lg:block">
          <input name="q" placeholder="Rechercher…  marque, contact, facture" className="input !text-xs" />
        </form>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((n) => <NavLink key={n.href} href={n.href} icon={n.icon} label={n.label} count={n.countKey ? counts[n.countKey] : 0} />)}
        </nav>
        <div className="hidden px-3 pt-4 lg:block">
          <Link href="/hub/brands/new" className="btn btn-accent w-full">+ Ajouter une marque</Link>
          {inbound[0]?.c > 0 && <Link href="/hub/notifications" className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{inbound[0].c} demande(s) entrante(s) à traiter</Link>}
        </div>
        <div className="absolute bottom-0 hidden w-full border-t border-zinc-100 p-3 lg:block">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <Link href="/" target="_blank" className="hover:text-zinc-900">Site public ↗</Link>
            <form action={logout}><button className="hover:text-zinc-900">Déconnexion</button></form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <form action="/hub/search" className="mb-4 lg:hidden"><input name="q" placeholder="Rechercher…" className="input" /></form>
        {children}
      </main>
    </div>
  );
}
