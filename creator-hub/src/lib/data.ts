import { q } from "./db";
import type { Dataset } from "./stats";

export async function loadDataset(): Promise<Dataset> {
  const [brands, contacts, outreach, responses, interactions, deals, documents, expenses, sectors] = await Promise.all([
    q(`select b.id, b.name, b.sector_id, b.created_at, b.do_not_contact, s.kind as stage_kind, s.key as stage_key
       from brands b left join pipeline_stages s on s.id=b.stage_id`),
    q(`select id, brand_id, first_name, last_name, role, role_type, email, opted_out from contacts`),
    q(`select id, brand_id, contact_id, channel, kind, sent_at, follow_up_at::text as follow_up_at, follow_up_done from outreach`),
    q(`select id, brand_id, contact_id, outreach_id, received_at, classification, intents from responses`),
    q(`select brand_id, type, occurred_at from interactions`),
    q(`select id, brand_id, collab_type, service_category, status, planned_price, negotiated_price, gift_value, signed_at::text as signed_at, created_at, production_hours, estimated_costs from deals`),
    q(`select id, kind, status, brand_id, deal_id, lines, deposit, paid_amount, issue_date::text as issue_date, due_date::text as due_date, paid_at::text as paid_at, number from documents`),
    q(`select amount, spent_at::text as spent_at from expenses`),
    q(`select id, name, color from sectors where archived=false order by position, id`),
  ]);
  return { brands, contacts, outreach, responses, interactions, deals, documents, expenses, sectors } as unknown as Dataset;
}

export async function getSectors() {
  return q<{ id: number; name: string; color: string; position: number; archived: boolean }>(`select * from sectors order by archived, position, id`);
}
export async function getStages() {
  return q<{ id: number; key: string; label: string; position: number; kind: string }>(`select * from pipeline_stages order by position`);
}
export async function unreadCount() {
  const r = await q<{ c: number }>(`select count(*)::int as c from notifications where read_at is null`);
  return r[0]?.c ?? 0;
}
