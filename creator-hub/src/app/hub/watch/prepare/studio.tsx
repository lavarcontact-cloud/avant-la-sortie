"use client";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/client";
import { buildMessages } from "@/lib/templates";
import { COLLAB_TYPES, type CollabType } from "@/lib/constants";

type Contact = { id: number; first_name: string | null; label: string };

export function CandidateStudio({ brand, defaultAngle, collabs, contacts, profile }: { brand: { name: string; sector: string | null }; defaultAngle: string; collabs: CollabType[]; contacts: Contact[]; profile: any }) {
  const [collab, setCollab] = useState<CollabType>(collabs[0] ?? "ugc_paid");
  const [angle, setAngle] = useState(defaultAngle);
  const [cid, setCid] = useState<number | "">(contacts[0]?.id ?? "");
  const [tab, setTab] = useState<"email" | "instagram" | "linkedin" | "followUp" | "ugcIdea">("email");
  const contact = contacts.find((c) => c.id === cid);
  const m = useMemo(() => buildMessages({ brand: { name: brand.name, sector: brand.sector }, contact: contact ? { first_name: contact.first_name } : null, profile, collabType: collab, angle }), [brand, contact, profile, collab, angle]);
  const text = tab === "email" ? `Objet : ${m.subject}\n\n${m.email}` : m[tab];
  const labels = { email: "Email", instagram: "DM Instagram", linkedin: "LinkedIn", followUp: "Relance", ugcIdea: "Idée de campagne" };
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="input" value={collab} onChange={(e) => setCollab(e.target.value as CollabType)}>{Object.entries(COLLAB_TYPES).map(([k, c]) => <option key={k} value={k}>{collabs.includes(k as CollabType) ? "★ " : ""}{c.label}</option>)}</select>
        <select className="input" value={cid} onChange={(e) => setCid(e.target.value ? Number(e.target.value) : "")}><option value="">Sans destinataire nommé</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </div>
      <textarea className="input !text-xs" rows={2} value={angle} onChange={(e) => setAngle(e.target.value)} />
      <div className="flex flex-wrap gap-1">{(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <button type="button" key={k} onClick={() => setTab(k)} className={`rounded-md px-2 py-0.5 text-xs ${tab === k ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{labels[k]}</button>)}</div>
      <div className="relative"><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-xs leading-relaxed">{text}</pre><div className="absolute right-2 top-2"><CopyButton text={text} /></div></div>
      {m.missing.length > 0 && <p className="text-[0.7rem] text-amber-700">À compléter : {m.missing.map((x) => x.replace(/^\[À COMPLÉTER : |\]$/g, "")).join(" · ")}</p>}
    </div>
  );
}
