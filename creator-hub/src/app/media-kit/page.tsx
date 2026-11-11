import Link from "next/link";
import { getSetting, DEFAULT_PROFILE, type ProfileSettings } from "@/lib/settings";
import { getSectors } from "@/lib/data";
import { COLLAB_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media Kit" };

export default async function MediaKit() {
  const [p, sectors] = await Promise.all([getSetting<ProfileSettings>("profile", DEFAULT_PROFILE), getSectors()]);
  return (
    <main className="min-h-dvh bg-paper text-ink print:bg-white">
      <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.2em] print:hidden"><Link href="/">← Site</Link><span className="text-ink/40">Imprimer → PDF (Ctrl/Cmd + P)</span></div>
        <header className="mt-12 border-b-4 border-ink pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Media Kit · {new Date().getFullYear()}</p>
          <h1 className="mt-4 font-display text-6xl font-extrabold tracking-tight">{p.display_name}</h1>
          <p className="mt-3 text-xl text-ink/70">{p.headline || "Créateur de contenu · Réalisateur · Photographe"}</p>
          {p.city && <p className="mt-1 font-mono text-xs text-ink/50">{p.city}</p>}
        </header>
        {p.bio && <p className="mt-10 text-lg leading-relaxed">{p.bio}</p>}
        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Audience — chiffres vérifiés</h2>
          {p.stats.length === 0 ? <p className="mt-4 text-ink/50">Statistiques communiquées sur demande.</p> : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{p.stats.map((s, i) => <div key={i} className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="font-display text-4xl font-bold">{s.value}</div><div className="text-sm">{s.label}</div><div className="mt-2 font-mono text-[0.62rem] uppercase text-ink/40">{s.source}{s.date ? ` · ${s.date}` : ""}</div></div>)}</div>
          )}
        </section>
        <section className="mt-12 grid gap-10 sm:grid-cols-2">
          <div><h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Collaborations</h2>
            <ul className="mt-4 space-y-2">{Object.values(COLLAB_TYPES).map((c) => <li key={c.label}><b>{c.label}</b><div className="text-sm text-ink/60">{c.hint}</div></li>)}</ul></div>
          <div><h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Univers</h2>
            <ul className="mt-4 space-y-1.5">{sectors.filter((s) => !s.archived).map((s) => <li key={s.id} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</li>)}</ul></div>
        </section>
        {p.references.length > 0 && <section className="mt-12"><h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Références</h2>
          <ul className="mt-4 divide-y divide-ink/10">{p.references.map((r, i) => <li key={i} className="flex justify-between gap-4 py-3"><span><b>{r.name}</b> — {r.detail}</span><span className="font-mono text-xs text-ink/50">{r.year}</span></li>)}</ul></section>}
        <footer className="mt-14 border-t border-ink/10 pt-6 text-sm">
          <b>Contact</b> {p.email && <>· {p.email}</>} {[p.instagram, p.tiktok, p.youtube, p.linkedin].filter(Boolean).map((u) => <span key={u}> · {u}</span>)}
          <p className="mt-2 text-xs text-ink/50">Tous les contenus sponsorisés et produits reçus sont clairement identifiés.</p>
        </footer>
      </div>
    </main>
  );
}
