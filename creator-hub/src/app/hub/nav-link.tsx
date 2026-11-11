"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label, icon, count }: { href: string; label: string; icon: string; count?: number }) {
  const path = usePathname();
  const active = href === "/hub" ? path === "/hub" : path.startsWith(href);
  return (
    <Link href={href} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.83rem] transition ${active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}>
      <span className={`w-4 text-center text-xs ${active ? "text-accent" : "text-zinc-400"}`}>{icon}</span>
      <span>{label}</span>
      {count ? <span className={`ml-auto rounded-full px-1.5 text-[0.65rem] font-semibold ${active ? "bg-accent text-white" : "bg-accent-soft text-[#c2381d]"}`}>{count}</span> : null}
    </Link>
  );
}
