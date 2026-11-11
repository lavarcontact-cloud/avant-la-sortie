"use client";
import { useState } from "react";
import { ActionForm } from "@/components/client";
import { saveProfile } from "../actions";
import type { ProfileSettings } from "@/lib/settings";

export function ProfileForm({ p }: { p: ProfileSettings }) {
  const [stats, setStats] = useState(p.stats);
  const [refs, setRefs] = useState(p.references);
  const f = (k: keyof ProfileSettings, label: string, ph = "", area = false) => (
    <label className={`field ${area ? "sm:col-span-2" : ""}`}><span>{label}</span>
      {area ? <textarea name={k} rows={3} defaultValue={p[k] as string} placeholder={ph} className="input" /> : <input name={k} defaultValue={p[k] as string} placeholder={ph} className="input" />}</label>
  );
  return (
    <ActionForm action={saveProfile} submitLabel="Enregistrer le profil" className="space-y-5">
      <input type="hidden" name="stats" value={JSON.stringify(stats)} />
      <input type="hidden" name="references" value={JSON.stringify(refs)} />
      <div className="grid gap-3 sm:grid-cols-2">
        {f("display_name", "Nom affiché")}{f("headline", "Titre (site public)", "Créateur de contenu · Réalisateur · Photographe")}
        {f("pitch", "Pitch une phrase (utilisé dans les messages)", "Je réalise des contenus vidéo et photo pour des marques et des artistes.", true)}
        {f("bio", "Présentation (site public)", "", true)}
        {f("city", "Ville")}{f("email", "Email professionnel public")}
        {f("instagram", "Instagram (URL)")}{f("tiktok", "TikTok (URL)")}{f("youtube", "YouTube (URL)")}{f("linkedin", "LinkedIn (URL)")}
        {f("portfolio_url", "Lien portfolio")}{f("media_kit_url", "Lien Media Kit (PDF ou page /media-kit)")}
        {f("signature", "Signature des messages", "Sébastien Fula-Pitu\nCréateur de contenu · 06…", true)}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Statistiques vérifiées (Media Kit)</div>
        <p className="mb-2 text-xs text-zinc-500">Uniquement des chiffres issus de vos outils (Instagram Insights, YouTube Studio…), avec source et date.</p>
        {stats.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input className="input" placeholder="Abonnés Instagram" value={s.label} onChange={(e) => setStats(stats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input className="input" placeholder="11 365" value={s.value} onChange={(e) => setStats(stats.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
            <input className="input" placeholder="Source : Instagram Insights" value={s.source} onChange={(e) => setStats(stats.map((x, j) => j === i ? { ...x, source: e.target.value } : x))} />
            <input className="input" type="date" value={s.date} onChange={(e) => setStats(stats.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
            <button type="button" className="btn btn-ghost" onClick={() => setStats(stats.filter((_, j) => j !== i))}>Retirer</button>
          </div>))}
        <button type="button" className="btn btn-ghost" onClick={() => setStats([...stats, { label: "", value: "", source: "", date: "" }])}>+ Statistique</button>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Références réellement réalisées</div>
        {refs.map((r, i) => (
          <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input className="input" placeholder="Projet / client" value={r.name} onChange={(e) => setRefs(refs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            <input className="input sm:col-span-2" placeholder="Rôle et livrables" value={r.detail} onChange={(e) => setRefs(refs.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} />
            <input className="input" placeholder="Année" value={r.year} onChange={(e) => setRefs(refs.map((x, j) => j === i ? { ...x, year: e.target.value } : x))} />
            <div className="flex gap-1"><input className="input" placeholder="Lien" value={r.url} onChange={(e) => setRefs(refs.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} /><button type="button" className="btn btn-ghost" onClick={() => setRefs(refs.filter((_, j) => j !== i))}>×</button></div>
          </div>))}
        <button type="button" className="btn btn-ghost" onClick={() => setRefs([...refs, { name: "", detail: "", year: "", url: "" }])}>+ Référence</button>
      </div>
    </ActionForm>
  );
}
