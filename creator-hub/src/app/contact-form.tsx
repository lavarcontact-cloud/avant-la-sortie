"use client";
import { useState } from "react";
import { COLLAB_TYPES } from "@/lib/constants";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | string>("idle");
  const cls = "w-full border-b border-white/15 bg-transparent px-0 py-3 text-[0.95rem] text-white placeholder:text-white/30 outline-none focus:border-accent";
  if (state === "ok") return <div className="rounded-2xl border border-white/10 p-8 text-lg text-white">Merci, votre demande est bien reçue. Je reviens vers vous rapidement.</div>;
  return (
    <form className="grid gap-x-8 gap-y-2 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setState("sending");
      const r = await fetch("/api/contact", { method: "POST", body: new FormData(e.currentTarget) });
      const j = await r.json().catch(() => ({}));
      setState(r.ok ? "ok" : j.error ?? "Erreur, réessayez.");
    }}>
      <input name="company" required placeholder="Entreprise / marque *" className={cls} />
      <input name="name" required placeholder="Votre nom *" className={cls} />
      <input name="email" type="email" required placeholder="Email professionnel *" className={cls} />
      <select name="collab_type" className={`${cls} [&>option]:text-black`} defaultValue=""><option value="">Type de collaboration</option>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
      <input name="budget" placeholder="Budget indicatif (facultatif)" className={`${cls} sm:col-span-2`} />
      <textarea name="message" required rows={4} placeholder="Votre projet, vos délais, les livrables attendus… *" className={`${cls} resize-none sm:col-span-2`} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="mt-3 flex items-start gap-2 text-xs text-white/50 sm:col-span-2"><input type="checkbox" name="consent" required className="mt-0.5" />J'accepte que ces informations soient utilisées uniquement pour répondre à ma demande.</label>
      <div className="mt-4 flex items-center gap-4 sm:col-span-2">
        <button disabled={state === "sending"} className="rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.03] disabled:opacity-60">{state === "sending" ? "Envoi…" : "Proposer une collaboration →"}</button>
        {state !== "idle" && state !== "sending" && <span className="text-sm text-red-400">{state}</span>}
      </div>
    </form>
  );
}
