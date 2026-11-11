import Link from "next/link";
import { q } from "@/lib/db";
import { getStages } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { setBrandStage } from "../actions";

export const metadata = { title: "Pipeline" };

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const showAll = (await searchParams).all === "1";
  const stages = await getStages();
  const brands = await q<any>(`select b.id, b.name, b.stage_id, b.score, b.next_follow_up::text as nf, s.color from brands b left join sectors s on s.id=b.sector_id order by b.score desc nulls last, b.updated_at desc`);
  const visible = stages.filter((s) => showAll || s.kind === "open" || ["confirmed", "in_progress", "invoice_sent", "payment_pending"].includes(s.key));
  return (
    <div>
      <PageHeader title="Pipeline commercial" subtitle="Déplacez une marque en changeant son statut. Libellés modifiables dans Paramètres."
        actions={<Link href={showAll ? "/hub/pipeline" : "/hub/pipeline?all=1"} className="btn btn-ghost">{showAll ? "Masquer clos / refus" : "Afficher tous les statuts"}</Link>} />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {visible.map((st) => {
          const items = brands.filter((b) => b.stage_id === st.id);
          return (
            <div key={st.id} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-zinc-700">{st.position}. {st.label}</span>
                <span className="rounded-full bg-zinc-200 px-1.5 text-[0.65rem] font-semibold text-zinc-600">{items.length}</span>
              </div>
              <div className={`min-h-24 space-y-2 rounded-xl p-2 ${st.kind === "won" ? "bg-emerald-50" : st.kind === "lost" ? "bg-red-50/60" : st.kind === "dnc" ? "bg-zinc-200/60" : "bg-zinc-100"}`}>
                {items.map((b) => (
                  <div key={b.id} className="card p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/hub/brands/${b.id}`} className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color ?? "#d4d4d8" }} />{b.name}</Link>
                      {b.score !== null && <span className="text-[0.65rem] tabular text-zinc-400">{b.score}</span>}
                    </div>
                    {b.nf && <div className="mt-0.5 text-[0.68rem] text-zinc-500">Relance {b.nf}</div>}
                    <form action={setBrandStage} className="mt-2"><input type="hidden" name="brand_id" value={b.id} />
                      <AutoSubmitSelect name="stage_id" defaultValue={b.stage_id} className="input !py-0.5 !text-[0.7rem]">{stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</AutoSubmitSelect></form>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
