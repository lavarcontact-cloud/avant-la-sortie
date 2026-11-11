import Link from "next/link";
import { q } from "@/lib/db";
import { CLASSIFICATIONS, INTENTS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { reclassifyResponse } from "../actions";

export const metadata = { title: "Réponses" };

export default async function Responses({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const c = (await searchParams).c;
  const filter = c && c in CLASSIFICATIONS ? c : null;
  const rows = await q<any>(`select r.*, b.name, ct.first_name, ct.last_name from responses r join brands b on b.id=r.brand_id left join contacts ct on ct.id=r.contact_id
    ${filter ? "where r.classification=$1" : ""} order by r.received_at desc limit 300`, filter ? [filter] : []);
  const counts = await q<{ classification: string; n: number }>(`select classification, count(*)::int n from responses group by 1`);
  const cnt = Object.fromEntries(counts.map((x) => [x.classification, x.n]));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Réponses" subtitle="Enregistrez les réponses depuis la fiche marque. Classification par règles, corrigeable à tout moment." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/hub/responses" className={`btn ${!filter ? "btn-primary" : "btn-ghost"}`}>Toutes</Link>
        {Object.entries(CLASSIFICATIONS).map(([k, v]) => <Link key={k} href={`/hub/responses?c=${k}`} className={`btn ${filter === k ? "btn-primary" : "btn-ghost"}`}>{v.label} <span className="text-xs opacity-60">{cnt[k] ?? 0}</span></Link>)}
      </div>
      {rows.length === 0 ? <Empty title="Aucune réponse enregistrée">Ouvrez une fiche marque → « Réponse reçue ». La connexion Gmail n'est pas encore active : la saisie est manuelle.</Empty> : (
        <Card pad={false}>
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id} className={`p-4 ${r.classification === "positive" ? "bg-emerald-50/40" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/hub/brands/${r.brand_id}`} className="font-medium hover:underline">{r.name}</Link>
                    {(r.first_name || r.last_name) && <span className="text-sm text-zinc-500">{[r.first_name, r.last_name].filter(Boolean).join(" ")}</span>}
                    <Badge tone={CLASSIFICATIONS[r.classification as keyof typeof CLASSIFICATIONS].tone}>{CLASSIFICATIONS[r.classification as keyof typeof CLASSIFICATIONS].label}</Badge>
                    {(r.intents as string[]).map((i) => <Badge key={i} tone="accent">{INTENTS[i as keyof typeof INTENTS]}</Badge>)}
                    <span className="text-xs text-zinc-400">{fmtDateTime(r.received_at)} · {r.classified_by === "manual" ? "manuel" : `règles ${Math.round(Number(r.confidence) * 100)} %`}</span>
                  </div>
                  <form action={reclassifyResponse}><input type="hidden" name="id" value={r.id} />
                    <AutoSubmitSelect name="classification" defaultValue={r.classification} className="input !w-auto !py-1 !text-xs">{Object.entries(CLASSIFICATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</AutoSubmitSelect></form>
                </div>
                {r.content && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-600">{r.content}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
