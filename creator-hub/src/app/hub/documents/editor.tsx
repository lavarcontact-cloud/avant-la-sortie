"use client";
import { useState } from "react";
import { ActionForm } from "@/components/client";
import { saveDocument } from "../actions";
import { docTotals, eur, type DocLine } from "@/lib/money";

export function DocumentEditor({ doc, brands, deals, defaultVat, vatExempt }: {
  doc: any; brands: { id: number; name: string }[]; deals: { id: number; title: string; brand_id: number; price: number | null }[]; defaultVat: number; vatExempt: boolean;
}) {
  const vat = vatExempt ? 0 : defaultVat;
  const [lines, setLines] = useState<DocLine[]>(doc.lines?.length ? doc.lines : [{ description: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: vat }]);
  const [deposit, setDeposit] = useState<number>(Number(doc.deposit) || 0);
  const [brandId, setBrandId] = useState<string>(doc.brand_id ? String(doc.brand_id) : "");
  const t = docTotals(lines, deposit);
  const set = (i: number, k: keyof DocLine, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: k === "description" ? v : Number(v) } : l)));
  return (
    <ActionForm action={saveDocument} submitLabel={doc.id ? "Enregistrer le brouillon" : "Créer le brouillon"} className="space-y-5">
      {doc.id && <input type="hidden" name="id" value={doc.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="field"><span>Type</span><select name="kind" defaultValue={doc.kind ?? "quote"} className="input"><option value="quote">Devis</option><option value="invoice">Facture</option></select></label>
        <label className="field"><span>Marque (CRM)</span><select name="brand_id" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="input"><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="field"><span>Prestation liée</span><select name="deal_id" defaultValue={doc.deal_id ?? ""} className="input"><option value="">—</option>{deals.filter((d) => !brandId || String(d.brand_id) === brandId).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
        <label className="field"><span>Date d'émission</span><input type="date" name="issue_date" defaultValue={doc.issue_date ?? ""} className="input" /></label>
        <label className="field"><span>Échéance / validité</span><input type="date" name="due_date" defaultValue={doc.due_date ?? ""} className="input" /></label>
        <label className="field"><span>Acompte versé (€)</span><input type="number" step="0.01" min={0} name="deposit" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="input" /></label>
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Client (informations fournies par l'entreprise)</legend>
        <label className="field"><span>Raison sociale *</span><input name="client_name" required defaultValue={doc.client_name ?? ""} className="input" /></label>
        <label className="field"><span>Email facturation</span><input name="client_email" type="email" defaultValue={doc.client_email ?? ""} className="input" /></label>
        <label className="field sm:col-span-2"><span>Adresse</span><textarea name="client_address" rows={2} defaultValue={doc.client_address ?? ""} className="input" /></label>
        <label className="field"><span>SIRET client</span><input name="client_siret" defaultValue={doc.client_siret ?? ""} className="input" /></label>
        <label className="field"><span>N° TVA client</span><input name="client_vat" defaultValue={doc.client_vat ?? ""} className="input" /></label>
      </fieldset>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Lignes de prestation</div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border border-zinc-100 p-2">
              <textarea rows={1} placeholder="Désignation (livrables, formats, droits d'usage…)" value={l.description} onChange={(e) => set(i, "description", e.target.value)} className="input col-span-12 md:col-span-5" />
              <label className="col-span-3 md:col-span-1"><span className="text-[0.65rem] text-zinc-500">Qté</span><input type="number" step="0.5" min={0} value={l.quantity} onChange={(e) => set(i, "quantity", e.target.value)} className="input" /></label>
              <label className="col-span-4 md:col-span-2"><span className="text-[0.65rem] text-zinc-500">PU HT €</span><input type="number" step="0.01" min={0} value={l.unit_price} onChange={(e) => set(i, "unit_price", e.target.value)} className="input" /></label>
              <label className="col-span-2 md:col-span-1"><span className="text-[0.65rem] text-zinc-500">Remise %</span><input type="number" step="1" min={0} max={100} value={l.discount_pct ?? 0} onChange={(e) => set(i, "discount_pct", e.target.value)} className="input" /></label>
              <label className="col-span-3 md:col-span-1"><span className="text-[0.65rem] text-zinc-500">TVA %</span><select value={l.vat_rate} onChange={(e) => set(i, "vat_rate", e.target.value)} className="input" disabled={vatExempt}>{[0, 5.5, 10, 20].map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              <div className="col-span-10 flex items-end justify-end text-sm tabular md:col-span-1">{eur((l.quantity || 0) * (l.unit_price || 0) * (1 - (l.discount_pct || 0) / 100))}</div>
              <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="col-span-2 self-end text-zinc-400 hover:text-red-600 md:col-span-1" disabled={lines.length === 1}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost mt-2" onClick={() => setLines([...lines, { description: "", quantity: 1, unit_price: 0, discount_pct: 0, vat_rate: vat }])}>+ Ligne</button>
        {vatExempt && <p className="mt-2 text-xs text-zinc-500">Franchise en base de TVA activée dans vos paramètres : TVA à 0 % et mention « art. 293 B du CGI ».</p>}
      </div>
      <div className="ml-auto w-full max-w-xs space-y-1 rounded-xl bg-zinc-50 p-4 text-sm tabular">
        <div className="flex justify-between"><span className="text-zinc-500">Total HT</span><span>{eur(t.ht)}</span></div>
        {t.vatByRate.map((v) => <div key={v.rate} className="flex justify-between"><span className="text-zinc-500">TVA {v.rate} %</span><span>{eur(v.vat)}</span></div>)}
        <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold"><span>Total TTC</span><span>{eur(t.ttc)}</span></div>
        {t.deposit > 0 && <div className="flex justify-between"><span className="text-zinc-500">Acompte</span><span>− {eur(t.deposit)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Solde</span><span>{eur(t.balance)}</span></div>
      </div>
      <label className="field"><span>Notes / conditions particulières (droits d'usage, livrables, mention partenariat…)</span><textarea name="notes" rows={2} defaultValue={doc.notes ?? ""} className="input" /></label>
    </ActionForm>
  );
}
