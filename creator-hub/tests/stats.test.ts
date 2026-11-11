import { test } from "node:test";
import assert from "node:assert/strict";
import { computeKpis, sectorPerformance, contactPerformance, timingAnalysis, financeSummary, revenueByService, followUpsDue, type Dataset } from "../src/lib/stats";

const base = (): Dataset => ({
  sectors: [{ id: 1, name: "Tech", color: "#00f" }, { id: 2, name: "Food", color: "#f00" }],
  brands: [
    { id: 1, name: "Sony", sector_id: 1, stage_kind: "won", stage_key: "confirmed", created_at: "2026-11-01T10:00:00Z" },
    { id: 2, name: "MPB", sector_id: 1, stage_kind: "open", stage_key: "contacted", created_at: "2026-11-02T10:00:00Z" },
    { id: 3, name: "Resto", sector_id: 2, stage_kind: "open", stage_key: "to_study", created_at: "2026-11-03T10:00:00Z" },
  ],
  contacts: [{ id: 10, brand_id: 1, first_name: "Ana", last_name: null, role: "PR", role_type: "PR Manager", email: "a@sony.fr", opted_out: false }],
  outreach: [
    { id: 100, brand_id: 1, contact_id: 10, channel: "email", kind: "initial", sent_at: "2026-11-03T08:00:00Z", follow_up_at: "2026-11-10", follow_up_done: false },
    { id: 101, brand_id: 2, contact_id: null, channel: "instagram", kind: "initial", sent_at: "2026-11-04T17:00:00Z", follow_up_at: "2026-11-09", follow_up_done: false },
  ],
  responses: [{ id: 1, brand_id: 1, contact_id: 10, outreach_id: 100, received_at: "2026-11-04T08:00:00Z", classification: "positive", intents: ["meeting"] }],
  interactions: [{ brand_id: 1, type: "meeting", occurred_at: "2026-11-06T09:00:00Z" }],
  deals: [
    { id: 1, brand_id: 1, collab_type: "ugc_paid", service_category: "Pack UGC", status: "signed", planned_price: 1000, negotiated_price: 900, gift_value: null, signed_at: "2026-11-07", created_at: "2026-11-07T00:00:00Z", production_hours: 10, estimated_costs: 100 },
    { id: 2, brand_id: 2, collab_type: "gifting", service_category: "Gifting", status: "signed", planned_price: null, negotiated_price: null, gift_value: 2500, signed_at: "2026-11-08", created_at: "2026-11-08T00:00:00Z", production_hours: null, estimated_costs: null },
  ],
  documents: [{ id: 1, kind: "invoice", status: "partially_paid", brand_id: 1, deal_id: 1, number: "F-2026-0001", lines: [{ description: "UGC", quantity: 1, unit_price: 900, vat_rate: 0 }], deposit: 300, paid_amount: 100, issue_date: "2026-11-08", due_date: "2026-11-09", paid_at: "2026-11-09" }],
  expenses: [{ amount: 50, spent_at: "2026-11-05" }],
});
const from = Date.parse("2026-11-01T00:00:00Z"), to = Date.parse("2026-11-12T00:00:00Z");

test("KPIs : le gifting n'est jamais compté en chiffre d'affaires", () => {
  const k = computeKpis(base(), from, to, "2026-11-11");
  assert.equal(k.signed, 900);
  assert.equal(k.giftValue, 2500);
  assert.equal(k.invoiced, 900); assert.equal(k.collected, 400); assert.equal(k.outstanding, 500);
  assert.equal(k.outreach, 2); assert.equal(k.responses, 1); assert.equal(k.positive, 1); assert.equal(k.meetings, 1);
  assert.equal(k.collaborations, 2);
});
test("relances dues : exclut les démarches ayant reçu une réponse et les marques gagnées", () => {
  const due = followUpsDue(base(), "2026-11-11");
  assert.deepEqual(due.map((o) => o.id), [101]);
});
test("secteurs : taux de réponse = réponses / envois", () => {
  const rows = sectorPerformance(base());
  const tech = rows.find((r) => r.sector.id === 1)!;
  assert.equal(tech.outreach, 2); assert.equal(tech.responded, 1); assert.equal(tech.responseRate, 0.5);
  assert.equal(tech.signed, 900); assert.equal(tech.avgDeal, 900); assert.equal(tech.collected, 400);
  const food = rows.find((r) => r.sector.id === 2)!;
  assert.equal(food.responseRate, null);
});
test("interlocuteurs : délai de réponse et statut", () => {
  const [c] = contactPerformance(base(), Date.parse("2026-11-11T00:00:00Z"));
  assert.equal(c.avgResponseHours, 24); assert.equal(c.badge, "Relation établie");
});
test("interlocuteurs : pas de jugement « sans réponse » avant 3 tentatives sur 21 jours", () => {
  const ds = base(); ds.responses = []; ds.deals = [];
  ds.outreach = [1, 2, 3].map((i) => ({ id: 200 + i, brand_id: 1, contact_id: 10, channel: "email", kind: "initial", sent_at: `2026-11-0${i}T08:00:00Z`, follow_up_at: null, follow_up_done: true }));
  assert.equal(contactPerformance(ds, Date.parse("2026-11-11T00:00:00Z"))[0].badge, "En attente (pas assez de recul)");
  assert.match(contactPerformance(ds, Date.parse("2026-12-01T00:00:00Z"))[0].badge, /Sans réponse après 3/);
});
test("timing : taux par créneau en heure de Paris, et avertissement d'échantillon", () => {
  const t = timingAnalysis(base());
  // 08:00Z le mardi 3/11 = 09:00 Paris → mardi (1), créneau 9h-12h (index 1)
  assert.equal(t.grid[1][1].sent, 1); assert.equal(t.grid[1][1].rate, 1);
  assert.ok(t.recs[0].includes("Échantillon limité"));
  assert.equal(t.recs.length, 1); // aucune recommandation sans 5 envois par créneau
});
test("finances : encaissé, en retard, revenu par prestation", () => {
  const f = financeSummary(base(), "2026-11-11");
  assert.equal(f.collected, 400); assert.equal(f.overdueCount, 1); assert.equal(f.net, 350); assert.equal(f.giftValue, 2500);
  const s = revenueByService(base());
  const ugc = s.find((x) => x.category === "Pack UGC")!;
  assert.equal(ugc.signed, 900); assert.equal(ugc.perHour, 90); assert.equal(ugc.margin, 800); assert.equal(ugc.collected, 400);
  assert.equal(s.find((x) => x.category === "Gifting")!.signed, 0);
});
