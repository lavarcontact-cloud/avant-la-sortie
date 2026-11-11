import Link from "next/link";
import { q } from "@/lib/db";
import { todayParis, fmtDate, fmtDateTime } from "@/lib/dates";
import { CHANNELS } from "@/lib/constants";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import { markFollowUpDone, snoozeFollowUp } from "../actions";
import { getSetting, DEFAULT_NOTIF, type NotifSettings } from "@/lib/settings";

export const metadata = { title: "Relances" };

export default async function FollowUps() {
  const today = todayParis();
  const notif = await getSetting<NotifSettings>("notifications", DEFAULT_NOTIF);
  const rows = await q<any>(`
    select o.id, o.brand_id, o.channel, o.sent_at, o.follow_up_at::text as follow_up_at, o.subject, b.name, c.first_name, c.last_name, c.email,
      (select count(*)::int from outreach x where x.brand_id=o.brand_id and x.kind='follow_up'
        and x.sent_at > coalesce((select max(received_at) from responses where brand_id=o.brand_id), 'epoch')) as fu_count
    from outreach o join brands b on b.id=o.brand_id left join contacts c on c.id=o.contact_id left join pipeline_stages s on s.id=b.stage_id
    where o.follow_up_done=false and o.follow_up_at is not null and b.do_not_contact=false and coalesce(s.kind,'open')='open'
      and (c.id is null or c.opted_out=false) and not exists (select 1 from responses r where r.outreach_id=o.id)
    order by o.follow_up_at`);
  const due = rows.filter((r) => r.follow_up_at <= today);
  const upcoming = rows.filter((r) => r.follow_up_at > today);
  const Row = ({ r }: { r: any }) => (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link href={`/hub/brands/${r.brand_id}`} className="font-medium hover:underline">{r.name}</Link>
        <div className="text-xs text-zinc-500">{CHANNELS[r.channel as keyof typeof CHANNELS] ?? r.channel}{r.first_name || r.last_name ? ` → ${[r.first_name, r.last_name].filter(Boolean).join(" ")}` : ""} · envoyé {fmtDateTime(r.sent_at)}{r.subject ? ` · ${r.subject}` : ""}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={r.follow_up_at < today ? "red" : r.follow_up_at === today ? "accent" : "slate"}>{r.follow_up_at < today ? "En retard · " : ""}{fmtDate(r.follow_up_at)}</Badge>
        {r.fu_count >= notif.max_follow_ups ? <Badge tone="dark">Limite de relances atteinte</Badge> : <Badge>{r.fu_count}/{notif.max_follow_ups} relance(s)</Badge>}
        <Link href={`/hub/brands/${r.brand_id}`} className="btn btn-primary !py-1 !text-xs">Relancer</Link>
        <form action={snoozeFollowUp}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="days" value="3" /><Submit className="btn btn-ghost !py-1 !text-xs">+3 j</Submit></form>
        <form action={markFollowUpDone}><input type="hidden" name="id" value={r.id} /><Submit className="btn btn-ghost !py-1 !text-xs">Ne pas relancer</Submit></form>
      </div>
    </li>
  );
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Relances" subtitle={`Maximum ${notif.max_follow_ups} relances sans réponse par marque · délai par défaut J+${notif.follow_up_days}. Arrêt automatique en cas de refus ou d'opposition.`} />
      <Card title={`À faire aujourd'hui (${due.length})`} className="mb-4">
        {due.length === 0 ? <Empty title="Aucune relance due">Les relances apparaissent ici à leur date prévue.</Empty> : <ul className="divide-y divide-zinc-100">{due.map((r) => <Row key={r.id} r={r} />)}</ul>}
      </Card>
      <Card title={`À venir (${upcoming.length})`}>
        {upcoming.length === 0 ? <p className="text-sm text-zinc-500">Rien de planifié.</p> : <ul className="divide-y divide-zinc-100">{upcoming.map((r) => <Row key={r.id} r={r} />)}</ul>}
      </Card>
    </div>
  );
}
