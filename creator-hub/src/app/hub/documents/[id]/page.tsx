import Link from "next/link";
import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { getSetting, DEFAULT_LEGAL, missingLegal, type LegalSettings } from "@/lib/settings";
import { docTotals, eur } from "@/lib/money";
import { DOC_STATUS } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { PageHeader, Card, Badge, docTone } from "@/components/ui";
import { ActionForm, CopyButton, ConfirmSubmit, Disclosure } from "@/components/client";
import { issueDocument, setDocumentStatus, deleteDraft } from "../../actions";
import { DocumentEditor } from "../editor";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = await one<any>(`select *, issue_date::text as issue_date, due_date::text as due_date, paid_at::text as paid_at from documents where id=$1`, [id]);
  if (!d) notFound();
  const legal = await getSetting<LegalSettings>("legal", DEFAULT_LEGAL);
  const missing = missingLegal(legal);
  const t = docTotals(d.lines, d.deposit, d.paid_amount);
  const label = d.kind === "invoice" ? "Facture" : "Devis";
  const [brands, deals] = await Promise.all([
    q<{ id: number; name: string }>(`select id, name from brands order by name`),
    q<any>(`select id, title, brand_id, coalesce(negotiated_price, planned_price) as price from deals where collab_type<>'gifting'`),
  ]);
  const sender = legal.trade_name || legal.legal_name || "[votre nom]";
  const emailBody = `Bonjour,

Veuillez trouver ci-joint ${d.kind === "invoice" ? "la facture" : "le devis"} ${d.number ?? ""} d'un montant de ${eur(t.ttc).replace(/ /g, " ")} TTC${d.kind === "invoice" ? `, à régler avant le ${fmtDate(d.due_date)}` : `, valable jusqu'au ${fmtDate(d.due_date)}`}.

Je reste disponible pour toute question.

Bien cordialement,
${sender}`;
  const subject = `${label} ${d.number ?? ""} — ${sender}`;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-2 text-xs text-zinc-500"><Link href="/hub/documents" className="hover:text-zinc-900">← Devis & factures</Link></div>
      <PageHeader title={`${label} ${d.number ?? "— brouillon"}`} subtitle={<span className="flex items-center gap-2"><Badge tone={docTone(d.status)}>{DOC_STATUS[d.status as keyof typeof DOC_STATUS]}</Badge>{d.client_name} · {eur(t.ttc)} TTC</span>}
        actions={<a href={`/api/hub/documents/${id}/pdf`} className="btn btn-primary" target="_blank">↓ Télécharger le PDF</a>} />

      {!d.number && missing.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Document non finalisé.</b> Mentions manquantes pour émettre : {missing.join(", ")}. <Link href="/hub/settings#legal" className="underline">Compléter Paramètres → Facturation</Link>.
          Le PDF reste téléchargeable avec le filigrane « BROUILLON - NON FINALISÉ ».
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Aperçu">
            <iframe src={`/api/hub/documents/${id}/pdf?inline=1`} className="h-[720px] w-full rounded-lg border border-zinc-200" title="Aperçu PDF" />
          </Card>
          {!d.number && <Card title="Modifier le brouillon"><DocumentEditor doc={d} brands={brands} deals={deals} defaultVat={legal.default_vat_rate} vatExempt={legal.vat_exempt} /></Card>}
        </div>
        <div className="space-y-4">
          <Card title="Actions">
            {!d.number ? (
              <ActionForm action={issueDocument} submitLabel={`Émettre (attribuer le numéro)`} submitClass="btn btn-accent w-full">
                <input type="hidden" name="id" value={id} />
                <p className="text-xs text-zinc-500">L'émission attribue un numéro séquentiel définitif. {d.kind === "invoice" ? "Une facture émise ne peut plus être modifiée." : ""}</p>
              </ActionForm>
            ) : (
              <ActionForm action={setDocumentStatus} submitLabel="Mettre à jour" className="space-y-2">
                <input type="hidden" name="id" value={id} />
                <label className="field"><span>Statut</span><select name="status" defaultValue={d.status} className="input">{Object.entries(DOC_STATUS).filter(([k]) => d.kind === "invoice" ? k !== "accepted" : !["paid", "partially_paid", "overdue"].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                {d.kind === "invoice" && <>
                  <label className="field"><span>Montant réglé (hors acompte) — pour un paiement partiel</span><input name="paid_amount" type="number" step="0.01" min={0} defaultValue={d.paid_amount} className="input" /></label>
                  <label className="field"><span>Date de paiement</span><input name="paid_at" type="date" defaultValue={d.paid_at ?? ""} className="input" /></label>
                </>}
              </ActionForm>
            )}
            <dl className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-sm tabular">
              <div className="flex justify-between"><dt className="text-zinc-500">Total HT</dt><dd>{eur(t.ht)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">TVA</dt><dd>{eur(t.vat)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total TTC</dt><dd>{eur(t.ttc)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Acompte + réglé</dt><dd>{eur(t.deposit + t.paid)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Reste dû</dt><dd>{eur(t.balance)}</dd></div>
            </dl>
          </Card>
          <Card title="Préparer l'email d'envoi">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-zinc-600">Objet : {subject}</span><CopyButton text={subject} /></div>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-sans text-xs text-zinc-700">{emailBody}</pre>
              <div className="flex flex-wrap gap-2"><CopyButton text={emailBody} label="Copier le message" />
                <a className="btn btn-ghost !py-1 !text-xs" href={`mailto:${d.client_email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`}>Ouvrir dans ma messagerie</a></div>
              <p className="text-[0.7rem] text-zinc-400">Joignez le PDF téléchargé. Aucun envoi automatique.</p>
            </div>
          </Card>
          {d.kind === "quote" && d.number && <Card title="Devis accepté ?"><Link href={`/hub/documents/new?kind=invoice&brand=${d.brand_id ?? ""}&from=${id}`} className="btn btn-primary w-full">Créer la facture depuis ce devis</Link></Card>}
          {!d.number && <Card title="Zone sensible"><form action={deleteDraft}><input type="hidden" name="id" value={id} /><ConfirmSubmit message="Supprimer ce brouillon ?">Supprimer le brouillon</ConfirmSubmit></form></Card>}
        </div>
      </div>
    </div>
  );
}
