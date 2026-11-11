import Link from "next/link";
import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";
import { COLLAB_TYPES } from "@/lib/constants";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import { markNotificationsRead, markInboundHandled, inboundToBrand } from "../actions";
import { PushToggle } from "./push-toggle";
import { pushConfigured } from "@/lib/push";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const [rows, inbound] = await Promise.all([
    q<any>(`select * from notifications order by (read_at is null) desc, priority='high' desc, created_at desc limit 200`),
    q<any>(`select * from inbound_requests where handled=false order by created_at desc`),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Notifications" subtitle="Centre de notifications interne. Les push navigateur s'activent une fois les clés VAPID configurées."
        actions={<><PushToggle publicKey={pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY! : null} /><form action={markNotificationsRead}><Submit className="btn btn-ghost">Tout marquer comme lu</Submit></form></>} />
      {inbound.length > 0 && (
        <Card title={`Demandes de collaboration entrantes (${inbound.length})`} className="mb-4">
          <ul className="divide-y divide-zinc-100">{inbound.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><b>{r.company}</b> · {r.name} · <span className="text-sm text-zinc-500">{r.email}</span> {r.collab_type && <Badge>{COLLAB_TYPES[r.collab_type as keyof typeof COLLAB_TYPES]?.label ?? r.collab_type}</Badge>} {r.budget && <Badge tone="green">{r.budget}</Badge>}</div>
                <div className="flex gap-2"><form action={inboundToBrand}><input type="hidden" name="id" value={r.id} /><Submit className="btn btn-primary !py-1 !text-xs">Créer la fiche CRM</Submit></form>
                  <form action={markInboundHandled}><input type="hidden" name="id" value={r.id} /><Submit className="btn btn-ghost !py-1 !text-xs">Ignorer</Submit></form></div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{r.message}</p>
              <div className="text-xs text-zinc-400">{fmtDateTime(r.created_at)}</div>
            </li>))}</ul>
        </Card>
      )}
      {rows.length === 0 ? <Empty title="Aucune notification">Elles apparaissent quand vous enregistrez des réponses, quand une facture est payée ou en retard, ou quand des relances sont dues.</Empty> : (
        <Card pad={false}>
          <ul className="divide-y divide-zinc-100">{rows.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 p-4 ${!n.read_at ? (n.priority === "high" ? "bg-accent-soft" : "bg-sky-50/40") : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-zinc-200" : n.priority === "high" ? "bg-accent" : "bg-sky-500"}`} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${n.priority === "high" ? "font-semibold" : "font-medium"}`}>{n.title}</div>
                {n.body && <div className="text-sm text-zinc-600">{n.body}</div>}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-400">{fmtDateTime(n.created_at)}
                  {n.link && <Link href={n.link} className="text-zinc-700 underline">Ouvrir</Link>}
                  {n.type === "positive_response" && n.brand_id && <>
                    <Link href={`/hub/brands/${n.brand_id}`} className="text-zinc-700 underline">Voir la fiche</Link>
                    <Link href={`/hub/brands/${n.brand_id}`} className="text-zinc-700 underline">Préparer une réponse</Link>
                    <Link href={`/hub/brands/${n.brand_id}`} className="text-zinc-700 underline">Créer l'opportunité (prestation)</Link></>}
                </div>
              </div>
              {!n.read_at && <form action={markNotificationsRead}><input type="hidden" name="id" value={n.id} /><Submit className="text-xs text-zinc-400 hover:text-zinc-900">Lu</Submit></form>}
            </li>))}</ul>
        </Card>
      )}
    </div>
  );
}
