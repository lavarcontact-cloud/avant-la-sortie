import Link from "next/link";
import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { getSectors, getStages } from "@/lib/data";
import { getSetting, DEFAULT_PROFILE, type ProfileSettings } from "@/lib/settings";
import { CHANNELS, CLASSIFICATIONS, COLLAB_TYPES, INTENTS, INTERACTION_TYPES, DEAL_STATUS, DOC_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { eur } from "@/lib/money";
import { docTotals } from "@/lib/money";
import { Card, Badge, PageHeader, stageTone } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit, Disclosure, Submit } from "@/components/client";
import { setBrandStage, optOutContact, deleteContact, reclassifyResponse, deleteDeal, deleteBrand, markFollowUpDone } from "../../actions";
import { BrandForm } from "../brand-form";
import { MessageStudio, OutreachForm, ResponseForm, ContactForm, InteractionForm, DealForm } from "./widgets";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const brand = await one<any>(`select b.*, b.verified_at::text as verified_at, b.next_follow_up::text as next_follow_up, s.name as sector, s.color, st.label as stage, st.kind as stage_kind
    from brands b left join sectors s on s.id=b.sector_id left join pipeline_stages st on st.id=b.stage_id where b.id=$1`, [id]);
  if (!brand) notFound();
  const [sectors, stages, contacts, outreach, responses, interactions, deals, docs, profile] = await Promise.all([
    getSectors(), getStages(),
    q<any>(`select * from contacts where brand_id=$1 order by opted_out, created_at`, [id]),
    q<any>(`select o.*, o.follow_up_at::text as follow_up_at, c.first_name, c.last_name, c.role from outreach o left join contacts c on c.id=o.contact_id where o.brand_id=$1 order by sent_at desc`, [id]),
    q<any>(`select r.*, c.first_name, c.last_name from responses r left join contacts c on c.id=r.contact_id where r.brand_id=$1 order by received_at desc`, [id]),
    q<any>(`select i.*, c.first_name, c.last_name from interactions i left join contacts c on c.id=i.contact_id where i.brand_id=$1 order by occurred_at desc`, [id]),
    q<any>(`select *, signed_at::text as signed_at from deals where brand_id=$1 order by created_at desc`, [id]),
    q<any>(`select id, kind, number, status, lines, deposit, paid_amount, issue_date::text as issue_date, created_at from documents where brand_id=$1 order by created_at desc`, [id]),
    getSetting<ProfileSettings>("profile", DEFAULT_PROFILE),
  ]);
  const cn = (r: any) => [r.first_name, r.last_name].filter(Boolean).join(" ") || r.role || "";
  type Ev = { at: string; kind: string; title: string; body?: string | null; tone: string; extra?: React.ReactNode };
  const timeline: Ev[] = [
    ...outreach.map((o: any) => ({ at: o.sent_at, kind: o.kind === "follow_up" ? "Relance" : "Démarche", tone: "blue",
      title: `${CHANNELS[o.channel as keyof typeof CHANNELS] ?? o.channel}${cn(o) ? ` → ${cn(o)}` : ""}${o.subject ? ` · ${o.subject}` : ""}`, body: o.body,
      extra: o.follow_up_at ? <span className="text-xs text-zinc-500">Relance {o.follow_up_done ? "close" : `prévue le ${fmtDate(o.follow_up_at)}`}</span> : null })),
    ...responses.map((r: any) => ({ at: r.received_at, kind: "Réponse", tone: CLASSIFICATIONS[r.classification as keyof typeof CLASSIFICATIONS]?.tone ?? "slate",
      title: `${CLASSIFICATIONS[r.classification as keyof typeof CLASSIFICATIONS]?.label}${cn(r) ? ` · ${cn(r)}` : ""}`, body: r.content,
      extra: (
        <div className="flex flex-wrap items-center gap-2">
          {(r.intents as string[]).map((i) => <Badge key={i} tone="accent">{INTENTS[i as keyof typeof INTENTS] ?? i}</Badge>)}
          <span className="text-[0.7rem] text-zinc-400">{r.classified_by === "manual" ? "classée manuellement" : `détection par règles · confiance ${Math.round(Number(r.confidence) * 100)} %`}</span>
          <form action={reclassifyResponse} className="flex items-center gap-1"><input type="hidden" name="id" value={r.id} />
            <AutoSubmitSelect name="classification" defaultValue={r.classification} className="input !w-auto !py-0.5 !text-[0.7rem]">{Object.entries(CLASSIFICATIONS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</AutoSubmitSelect></form>
        </div>) })),
    ...interactions.map((i: any) => ({ at: i.occurred_at, kind: INTERACTION_TYPES[i.type as keyof typeof INTERACTION_TYPES] ?? i.type, tone: "violet", title: `${i.title}${cn(i) ? ` · ${cn(i)}` : ""}`, body: i.body })),
    ...deals.map((d: any) => ({ at: d.created_at, kind: "Prestation", tone: "green", title: `${d.title} · ${COLLAB_TYPES[d.collab_type as keyof typeof COLLAB_TYPES]?.label} · ${DEAL_STATUS[d.status as keyof typeof DEAL_STATUS]}`, body: null })),
    ...docs.map((d: any) => ({ at: d.created_at, kind: d.kind === "invoice" ? "Facture" : "Devis", tone: "amber", title: `${d.number ?? "Brouillon"} · ${eur(docTotals(d.lines, d.deposit).ttc)} · ${DOC_STATUS[d.status as keyof typeof DOC_STATUS]}`, extra: <Link href={`/hub/documents/${d.id}`} className="text-xs underline">Ouvrir</Link> })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const pendingFU = outreach.filter((o: any) => o.follow_up_at && !o.follow_up_done);
  const outreachOptions = outreach.map((o: any) => ({ id: o.id, label: `${fmtDate(o.sent_at)} · ${CHANNELS[o.channel as keyof typeof CHANNELS] ?? o.channel}${cn(o) ? ` · ${cn(o)}` : ""}` }));
  const blocked = brand.do_not_contact || brand.stage_kind === "dnc";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-2 text-xs text-zinc-500"><Link href="/hub/brands" className="hover:text-zinc-900">← Marques</Link></div>
      <PageHeader
        title={brand.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {brand.sector && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: brand.color }} />{brand.sector}</span>}
            {brand.score !== null && <Badge tone="dark">Score {brand.score}/100</Badge>}
            {blocked && <Badge tone="red">Ne plus contacter</Badge>}
            {brand.website && <a href={brand.website} target="_blank" rel="noreferrer" className="underline">Site ↗</a>}
            {brand.contact_page && <a href={brand.contact_page} target="_blank" rel="noreferrer" className="underline">Contact officiel ↗</a>}
            {brand.instagram && <a href={`https://instagram.com/${brand.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`} target="_blank" rel="noreferrer" className="underline">Instagram ↗</a>}
            <span className="text-zinc-400">{brand.verified_at ? `Vérifié le ${fmtDate(brand.verified_at)}` : "Informations non vérifiées"}</span>
          </span>
        }
        actions={
          <form action={setBrandStage} className="flex items-center gap-2">
            <input type="hidden" name="brand_id" value={id} />
            <Badge tone={stageTone(brand.stage_kind)}>Statut</Badge>
            <AutoSubmitSelect name="stage_id" defaultValue={brand.stage_id ?? ""} className="input !w-auto">{stages.map((s) => <option key={s.id} value={s.id}>{s.position}. {s.label}</option>)}</AutoSubmitSelect>
          </form>
        }
      />

      {pendingFU.length > 0 && !blocked && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-accent-soft px-4 py-3 text-sm">
          <span>Relance prévue le <b>{fmtDate(pendingFU[0].follow_up_at)}</b> ({outreach.filter((o: any) => o.kind === "follow_up").length} relance(s) déjà envoyée(s))</span>
          <form action={markFollowUpDone}><input type="hidden" name="id" value={pendingFU[0].id} /><Submit className="btn btn-ghost !py-1 !text-xs">Annuler la relance</Submit></form>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          {!blocked && <Card title="Préparer la prospection"><MessageStudio brand={{ name: brand.name, description: brand.description, opportunities: brand.opportunities, website: brand.website }} contacts={contacts} profile={profile} sector={brand.sector} /></Card>}
          <Card title="Enregistrer">
            <div className="flex flex-wrap gap-2">
              {!blocked && <Disclosure label="✉ Démarche envoyée"><OutreachForm brandId={id} contacts={contacts} /></Disclosure>}
              <Disclosure label="↩ Réponse reçue"><ResponseForm brandId={id} contacts={contacts} outreach={outreachOptions} /></Disclosure>
              <Disclosure label="☎ Appel · réunion · note"><InteractionForm brandId={id} contacts={contacts} /></Disclosure>
              <Disclosure label="€ Prestation / gifting"><DealForm brandId={id} /></Disclosure>
              <Link href={`/hub/documents/new?brand=${id}`} className="btn btn-ghost">▭ Devis / facture</Link>
            </div>
          </Card>
          <Card title={`Historique (${timeline.length})`}>
            {timeline.length === 0 ? <p className="text-sm text-zinc-500">Aucun échange enregistré.</p> : (
              <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-400 ring-1 ring-zinc-200" />
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={e.tone}>{e.kind}</Badge><span className="text-sm font-medium text-zinc-800">{e.title}</span><span className="text-xs text-zinc-400">{fmtDateTime(e.at)}</span></div>
                    {e.body && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-zinc-600">{e.body}</p>}
                    {e.extra && <div className="mt-1">{e.extra}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card title={`Interlocuteurs (${contacts.length})`}>
            <ul className="mb-3 divide-y divide-zinc-100">
              {contacts.map((c: any) => (
                <li key={c.id} className="py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{cn(c) || "Sans nom"} {c.opted_out && <Badge tone="dark">Opposition</Badge>}</div>
                      <div className="text-xs text-zinc-500">{[c.role, c.role_type].filter(Boolean).join(" · ")}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">{c.email && <span>{c.email}</span>}{c.linkedin && <a className="underline" href={c.linkedin.startsWith("http") ? c.linkedin : `https://${c.linkedin}`} target="_blank" rel="noreferrer">LinkedIn</a>}{c.instagram && <span>{c.instagram}</span>}{c.phone && <span>{c.phone}</span>}</div>
                      {c.source && <div className="text-[0.7rem] text-zinc-400">Source : {c.source}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!c.opted_out && <form action={optOutContact}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit message="Enregistrer une opposition ? Les relances seront arrêtées et l'adresse ajoutée à la liste d'opposition." className="btn btn-ghost !px-2 !py-0.5 !text-[0.7rem]">Opposition</ConfirmSubmit></form>}
                      <form action={deleteContact}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit message="Supprimer cet interlocuteur (droit à l'effacement) ?" className="btn btn-danger !px-2 !py-0.5 !text-[0.7rem]">×</ConfirmSubmit></form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Disclosure label="+ Ajouter un interlocuteur" defaultOpen={contacts.length === 0}><ContactForm brandId={id} /></Disclosure>
          </Card>

          <Card title={`Prestations (${deals.length})`}>
            {deals.length === 0 ? <p className="text-sm text-zinc-500">Aucune prestation.</p> : (
              <ul className="divide-y divide-zinc-100">
                {deals.map((d: any) => (
                  <li key={d.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <div><div className="font-medium">{d.title}</div>
                        <div className="text-xs text-zinc-500">{COLLAB_TYPES[d.collab_type as keyof typeof COLLAB_TYPES]?.label} · {d.service_category}</div></div>
                      <div className="text-right"><Badge tone={["signed", "in_progress", "delivered"].includes(d.status) ? "green" : d.status === "proposed" ? "blue" : "slate"}>{DEAL_STATUS[d.status as keyof typeof DEAL_STATUS]}</Badge>
                        <div className="mt-1 text-sm tabular">{d.collab_type === "gifting" ? <span className="text-zinc-500">Gifting · {eur(d.gift_value)} (hors CA)</span> : eur(d.negotiated_price ?? d.planned_price)}</div></div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Disclosure label="Modifier"><DealForm brandId={id} deal={d} /></Disclosure>
                      <Link href={`/hub/documents/new?brand=${id}&deal=${d.id}&kind=quote`} className="btn btn-ghost !text-xs">Devis</Link>
                      <Link href={`/hub/documents/new?brand=${id}&deal=${d.id}&kind=invoice`} className="btn btn-ghost !text-xs">Facture</Link>
                      <form action={deleteDeal}><input type="hidden" name="id" value={d.id} /><ConfirmSubmit message="Supprimer cette prestation ?" className="btn btn-danger !text-xs">×</ConfirmSubmit></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Fiche marque">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-zinc-500">Description</dt><dd>{brand.description || "—"}</dd>
              <dt className="text-zinc-500">Localisation</dt><dd>{[brand.city, brand.country].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-zinc-500">Type · taille</dt><dd>{[brand.brand_type, brand.company_size].filter(Boolean).join(" · ") || "—"}</dd>
              <dt className="text-zinc-500">Email public</dt><dd>{brand.public_email || "—"}</dd>
              <dt className="text-zinc-500">Service</dt><dd>{brand.department || "—"}</dd>
              <dt className="text-zinc-500">Source</dt><dd className="break-words">{brand.source || "—"}</dd>
              <dt className="text-zinc-500">Score</dt><dd>{brand.score ?? "—"} {brand.score_notes && <span className="text-zinc-500">— {brand.score_notes}</span>}</dd>
              <dt className="text-zinc-500">Opportunités</dt><dd className="flex flex-wrap gap-1">{(brand.opportunities as string[]).map((o) => <Badge key={o}>{COLLAB_TYPES[o as keyof typeof COLLAB_TYPES]?.label}</Badge>)}</dd>
              <dt className="text-zinc-500">Notes</dt><dd className="whitespace-pre-wrap">{brand.notes || "—"}</dd>
            </dl>
            <div className="mt-4"><Disclosure label="Modifier la fiche"><BrandForm sectors={sectors} stages={stages} brand={brand} /></Disclosure></div>
          </Card>

          <Card title="Zone sensible">
            <form action={deleteBrand} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={id} />
              <label className="field flex-1"><span>Tapez SUPPRIMER pour effacer la marque et tout son historique</span><input name="confirm" className="input" autoComplete="off" /></label>
              <ConfirmSubmit message="Suppression définitive. Continuer ?">Supprimer</ConfirmSubmit>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
