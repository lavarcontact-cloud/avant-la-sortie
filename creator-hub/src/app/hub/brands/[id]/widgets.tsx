"use client";
import { useMemo, useState } from "react";
import { ActionForm, CopyButton } from "@/components/client";
import { logOutreach, logResponse, logInteraction, createContact, saveDeal, type ActionState } from "../../actions";
import { buildMessages } from "@/lib/templates";
import { classifyResponse } from "@/lib/classify";
import { CHANNELS, CLASSIFICATIONS, COLLAB_TYPES, INTENTS, INTERACTION_TYPES, ROLE_TYPES, SERVICE_CATEGORIES, DEAL_STATUS, type CollabType } from "@/lib/constants";

type Contact = { id: number; first_name: string | null; last_name: string | null; role: string | null; email: string | null; opted_out: boolean };
const cname = (c: Contact) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.role || c.email || `Contact #${c.id}`;
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function MessageStudio({ brand, contacts, profile, sector }: { brand: any; contacts: Contact[]; profile: any; sector: string | null }) {
  const [collab, setCollab] = useState<CollabType>((brand.opportunities?.[0] as CollabType) || "ugc_paid");
  const [contactId, setContactId] = useState<number | "">(contacts.find((c) => !c.opted_out)?.id ?? "");
  const [angle, setAngle] = useState("");
  const contact = contacts.find((c) => c.id === contactId) ?? null;
  const m = useMemo(() => buildMessages({ brand: { ...brand, sector }, contact, profile, collabType: collab, angle }), [brand, contact, profile, collab, angle, sector]);
  const [tab, setTab] = useState<"email" | "instagram" | "linkedin" | "followUp" | "ugcIdea">("email");
  const labels = { email: "Email", instagram: "DM Instagram", linkedin: "LinkedIn", followUp: "Relance", ugcIdea: "Idée UGC" };
  const text = tab === "email" ? `Objet : ${m.subject}\n\n${m.email}` : m[tab];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field"><span>Type de collaboration</span>
          <select className="input" value={collab} onChange={(e) => setCollab(e.target.value as CollabType)}>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
        <label className="field"><span>Destinataire</span>
          <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : "")}><option value="">Sans nom (Bonjour,)</option>{contacts.filter((c) => !c.opted_out).map((c) => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label>
      </div>
      <p className="text-xs text-zinc-500">{COLLAB_TYPES[collab].hint}</p>
      <label className="field"><span>Angle personnalisé — ce que vous avez réellement vu chez la marque (vérifié)</span>
        <textarea className="input" rows={2} value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="ex. J'ai vu le lancement de votre nouvel hybride plein format et je tourne déjà mes clips en…" /></label>
      <div className="flex flex-wrap gap-1">{(Object.keys(labels) as (keyof typeof labels)[]).map((k) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === k ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>{labels[k]}</button>))}</div>
      <div className="relative">
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-[0.82rem] leading-relaxed text-zinc-800">{text}</pre>
        <div className="absolute right-2 top-2"><CopyButton text={text} /></div>
      </div>
      {m.missing.length > 0 && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">À compléter avant envoi : {m.missing.map((x) => x.replace("[À COMPLÉTER : ", "").replace("]", "")).join(" · ")}</p>}
      <p className="text-[0.7rem] text-zinc-400">Rien n'est envoyé automatiquement. Copiez, relisez, envoyez vous-même, puis enregistrez la démarche ci-dessous.</p>
    </div>
  );
}

export function OutreachForm({ brandId, contacts }: { brandId: number; contacts: Contact[] }) {
  return (
    <ActionForm action={logOutreach} submitLabel="Enregistrer la démarche" resetOnOk className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="brand_id" value={brandId} />
      <label className="field"><span>Canal</span><select name="channel" className="input">{Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Interlocuteur</span><select name="contact_id" className="input"><option value="">— (adresse générique / formulaire)</option>{contacts.filter((c) => !c.opted_out).map((c) => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label>
      <label className="field"><span>Type</span><select name="kind" className="input"><option value="initial">Premier contact</option><option value="follow_up">Relance</option></select></label>
      <label className="field"><span>Collaboration proposée</span><select name="collab_type" className="input"><option value="">—</option>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
      <label className="field"><span>Envoyé le</span><input type="datetime-local" name="sent_at" defaultValue={nowLocal()} className="input" /></label>
      <label className="field"><span>Relance prévue le (vide = J+7 auto)</span><input type="date" name="follow_up_at" className="input" /></label>
      <input type="hidden" name="auto_follow_up" value="1" />
      <label className="field sm:col-span-2"><span>Objet</span><input name="subject" className="input" /></label>
      <label className="field sm:col-span-2"><span>Message envoyé (pour l'historique)</span><textarea name="body" rows={3} className="input" /></label>
    </ActionForm>
  );
}

export function ResponseForm({ brandId, contacts, outreach }: { brandId: number; contacts: Contact[]; outreach: { id: number; label: string }[] }) {
  const [content, setContent] = useState("");
  const auto = useMemo(() => classifyResponse(content), [content]);
  return (
    <ActionForm action={logResponse} submitLabel="Enregistrer la réponse" resetOnOk className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="brand_id" value={brandId} />
      <label className="field"><span>Reçue le</span><input type="datetime-local" name="received_at" defaultValue={nowLocal()} className="input" /></label>
      <label className="field"><span>Canal</span><select name="channel" className="input">{Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>De</span><select name="contact_id" className="input"><option value="">— (auto : interlocuteur de la démarche)</option>{contacts.map((c) => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label>
      <label className="field"><span>En réponse à</span><select name="outreach_id" className="input"><option value="">Auto : dernière démarche</option>{outreach.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <label className="field sm:col-span-2"><span>Contenu de la réponse (collez le message)</span><textarea name="content" rows={4} className="input" value={content} onChange={(e) => setContent(e.target.value)} /></label>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:col-span-2">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-700">Détection par règles :</span>
          <span className="font-semibold">{CLASSIFICATIONS[auto.classification].label}</span>
          <span className="text-zinc-500">confiance {Math.round(auto.confidence * 100)} %</span>
          {auto.intents.map((i) => <span key={i} className="rounded bg-white px-1.5 py-0.5 ring-1 ring-zinc-200">{INTENTS[i]}</span>)}</div>
        <div className="mt-1 text-zinc-500">{auto.reasons.join(" · ")}. Vous pouvez corriger ci-dessous.</div>
      </div>
      <label className="field"><span>Classification</span><select name="classification" className="input" defaultValue=""><option value="">Utiliser la détection ({CLASSIFICATIONS[auto.classification].label})</option>{Object.entries(CLASSIFICATIONS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
      <div className="field"><span>Demandes (si différentes de la détection)</span>
        <div className="flex flex-wrap gap-1.5">{Object.entries(INTENTS).map(([k, l]) => <label key={k} className="flex items-center gap-1 text-xs"><input type="checkbox" name="intents" value={k} />{l}</label>)}</div></div>
    </ActionForm>
  );
}

export function ContactForm({ brandId }: { brandId: number }) {
  return (
    <ActionForm action={createContact} submitLabel="Ajouter l'interlocuteur" resetOnOk className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="brand_id" value={brandId} />
      <label className="field"><span>Prénom</span><input name="first_name" className="input" /></label>
      <label className="field"><span>Nom</span><input name="last_name" className="input" /></label>
      <label className="field"><span>Fonction (intitulé exact)</span><input name="role" className="input" placeholder="Influence Manager France" /></label>
      <label className="field"><span>Type de fonction</span><select name="role_type" className="input"><option value="">—</option>{ROLE_TYPES.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="field"><span>Email professionnel</span><input name="email" type="email" className="input" /></label>
      <label className="field"><span>LinkedIn</span><input name="linkedin" className="input" /></label>
      <label className="field"><span>Instagram</span><input name="instagram" className="input" /></label>
      <label className="field"><span>Téléphone pro</span><input name="phone" className="input" /></label>
      <label className="field sm:col-span-2"><span>Source (où cette info est-elle publiée ?) *si email/téléphone</span><input name="source" className="input" placeholder="Profil LinkedIn public, page presse officielle…" /></label>
      <p className="text-[0.7rem] text-zinc-400 sm:col-span-2">Données strictement professionnelles et publiques. Pas d'adresses privées.</p>
    </ActionForm>
  );
}

export function InteractionForm({ brandId, contacts }: { brandId: number; contacts: Contact[] }) {
  return (
    <ActionForm action={logInteraction} submitLabel="Ajouter à l'historique" resetOnOk className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="brand_id" value={brandId} />
      <label className="field"><span>Type</span><select name="type" className="input">{Object.entries(INTERACTION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Date (une réunion future apparaît dans « Rendez-vous à venir »)</span><input type="datetime-local" name="occurred_at" defaultValue={nowLocal()} className="input" /></label>
      <label className="field"><span>Titre</span><input name="title" required className="input" /></label>
      <label className="field"><span>Avec</span><select name="contact_id" className="input"><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label>
      <label className="field sm:col-span-2"><span>Détails / lien du document</span><textarea name="body" rows={2} className="input" /></label>
    </ActionForm>
  );
}

export function DealForm({ brandId, deal }: { brandId: number; deal?: any }) {
  const [collab, setCollab] = useState<string>(deal?.collab_type ?? "ugc_paid");
  const gift = collab === "gifting";
  return (
    <ActionForm action={saveDeal as (s: ActionState, f: FormData) => Promise<ActionState>} submitLabel={deal ? "Mettre à jour" : "Enregistrer la prestation"} resetOnOk={!deal} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="brand_id" value={brandId} />
      {deal && <input type="hidden" name="id" value={deal.id} />}
      <label className="field sm:col-span-3"><span>Intitulé</span><input name="title" required defaultValue={deal?.title} className="input" placeholder="Pack 3 vidéos UGC — lancement produit" /></label>
      <label className="field"><span>Type de collaboration</span><select name="collab_type" className="input" value={collab} onChange={(e) => setCollab(e.target.value)}>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></label>
      <label className="field"><span>Catégorie de prestation</span><select name="service_category" defaultValue={deal?.service_category ?? (gift ? "Gifting" : "UGC vidéo")} className="input">{SERVICE_CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="field"><span>Statut</span><select name="status" defaultValue={deal?.status ?? "proposed"} className="input">{Object.entries(DEAL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {gift ? (
        <label className="field sm:col-span-3"><span>Valeur du produit reçu (€) — jamais comptée en chiffre d'affaires</span><input name="gift_value" type="number" step="0.01" min={0} defaultValue={deal?.gift_value ?? ""} className="input" /></label>
      ) : (<>
        <label className="field"><span>Prix prévu (€ HT)</span><input name="planned_price" type="number" step="0.01" min={0} defaultValue={deal?.planned_price ?? ""} className="input" /></label>
        <label className="field"><span>Prix négocié (€ HT)</span><input name="negotiated_price" type="number" step="0.01" min={0} defaultValue={deal?.negotiated_price ?? ""} className="input" /></label>
        <label className="field"><span>Produit reçu en plus (€, hors CA)</span><input name="gift_value" type="number" step="0.01" min={0} defaultValue={deal?.gift_value ?? ""} className="input" /></label>
      </>)}
      <label className="field"><span>Date de signature</span><input name="signed_at" type="date" defaultValue={deal?.signed_at ?? ""} className="input" /></label>
      <label className="field"><span>Temps de production (h, facultatif)</span><input name="production_hours" type="number" step="0.5" min={0} defaultValue={deal?.production_hours ?? ""} className="input" /></label>
      <label className="field"><span>Coûts estimés (€, facultatif)</span><input name="estimated_costs" type="number" step="0.01" min={0} defaultValue={deal?.estimated_costs ?? ""} className="input" /></label>
      <label className="field sm:col-span-3"><span>Notes (livrables, droits d'usage, mention partenariat…)</span><textarea name="notes" rows={2} defaultValue={deal?.notes ?? ""} className="input" /></label>
      <p className="text-[0.7rem] text-zinc-400 sm:col-span-3">Le facturé et l'encaissé proviennent des factures liées à cette prestation (Devis & factures).</p>
    </ActionForm>
  );
}
