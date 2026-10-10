import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Tableau de bord"],
  ["/admin/demandes", "Demandes"],
  ["/admin/commandes", "Commandes"],
  ["/admin/contenus", "Contenus à vérifier"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  return (
    <div className="min-h-svh bg-[var(--color-ink)]">
      {authed && (
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-ink)]/95">
          <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-5 py-3 text-sm">
            <Link href="/" className="t-display shrink-0 text-base">SFP<span className="text-[var(--color-accent)]">.</span> admin</Link>
            <nav aria-label="Admin" className="flex gap-1">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 text-[var(--color-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]">{label}</Link>
              ))}
            </nav>
            <form action={logout} className="ml-auto shrink-0">
              <button type="submit" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">Déconnexion</button>
            </form>
          </div>
        </header>
      )}
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
