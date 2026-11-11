"use client";
import { ActionForm } from "@/components/client";
import { createBrand, updateBrand } from "../actions";
import { COLLAB_TYPES, COMPANY_SIZES, BRAND_TYPES } from "@/lib/constants";

type Opt = { id: number; name?: string; label?: string };
export function BrandForm({ sectors, stages, brand }: { sectors: Opt[]; stages: Opt[]; brand?: Record<string, any> }) {
  const v = (k: string) => (brand?.[k] ?? "") as string;
  const opps: string[] = brand?.opportunities ?? [];
  return (
    <ActionForm action={brand ? updateBrand : createBrand} submitLabel={brand ? "Enregistrer la fiche" : "Créer la marque"} className="space-y-6">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Identité</legend>
        <label className="field"><span>Nom de la marque *</span><input name="name" required defaultValue={v("name")} className="input" placeholder="ex. Sony France" /></label>
        <label className="field"><span>Secteur</span>
          <select name="sector_id" defaultValue={v("sector_id")} className="input"><option value="">—</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {!brand && <label className="field"><span>Statut pipeline</span>
          <select name="stage_id" defaultValue="" className="input"><option value="">Marque à étudier</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
        <label className="field"><span>Site officiel</span><input name="website" type="url" defaultValue={v("website")} className="input" placeholder="https://" /></label>
        <label className="field"><span>Type de marque</span><select name="brand_type" defaultValue={v("brand_type")} className="input"><option value="">—</option>{BRAND_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Taille</span><select name="company_size" defaultValue={v("company_size")} className="input"><option value="">—</option>{COMPANY_SIZES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Pays</span><input name="country" defaultValue={v("country") || (brand ? "" : "France")} className="input" /></label>
        <label className="field"><span>Ville</span><input name="city" defaultValue={v("city")} className="input" /></label>
        <label className="field sm:col-span-2 lg:col-span-3"><span>Description (faits vérifiés uniquement)</span><textarea name="description" rows={2} defaultValue={v("description")} className="input" /></label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Canaux officiels</legend>
        <label className="field"><span>Instagram</span><input name="instagram" defaultValue={v("instagram")} className="input" placeholder="@compte" /></label>
        <label className="field"><span>LinkedIn (page entreprise)</span><input name="linkedin" defaultValue={v("linkedin")} className="input" /></label>
        <label className="field"><span>TikTok</span><input name="tiktok" defaultValue={v("tiktok")} className="input" /></label>
        <label className="field"><span>Page de contact / programme créateurs</span><input name="contact_page" type="url" defaultValue={v("contact_page")} className="input" placeholder="https://" /></label>
        <label className="field"><span>Adresse pro publiée</span><input name="public_email" type="email" defaultValue={v("public_email")} className="input" placeholder="partenariats@…" /></label>
        <label className="field"><span>Service concerné</span><input name="department" defaultValue={v("department")} className="input" placeholder="Influence, RP, Marketing…" /></label>
        <label className="field sm:col-span-2"><span>Source de l'information (URL ou référence) — obligatoire si email</span><input name="source" defaultValue={v("source")} className="input" placeholder="https://marque.com/contact — page officielle" /></label>
        <label className="field"><span>Date de vérification</span><input name="verified_at" type="date" defaultValue={v("verified_at")?.slice?.(0, 10)} className="input" /></label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Qualification</legend>
        <label className="field"><span>Score de pertinence /100</span><input name="score" type="number" min={0} max={100} defaultValue={v("score")} className="input" /></label>
        <label className="field sm:col-span-2"><span>Justification du score (pas une probabilité de signature)</span><input name="score_notes" defaultValue={v("score_notes")} className="input" placeholder="Programme créateurs actif, besoin contenu vidéo, produit cohérent avec mon matériel…" /></label>
        <div className="field sm:col-span-2 lg:col-span-3"><span>Opportunités de collaboration possibles</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(COLLAB_TYPES).map(([k, c]) => (
              <label key={k} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white" title={c.hint}>
                <input type="checkbox" name="opportunities" value={k} defaultChecked={opps.includes(k)} className="sr-only" />{c.label}
              </label>
            ))}
          </div>
        </div>
        <label className="field"><span>Prochaine action / relance</span><input name="next_follow_up" type="date" defaultValue={v("next_follow_up")?.slice?.(0, 10)} className="input" /></label>
        <label className="field sm:col-span-2 lg:col-span-3"><span>Notes</span><textarea name="notes" rows={3} defaultValue={v("notes")} className="input" /></label>
      </fieldset>
    </ActionForm>
  );
}
