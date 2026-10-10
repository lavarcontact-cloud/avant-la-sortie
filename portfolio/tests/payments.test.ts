import Stripe from "stripe";
import { beforeAll, describe, expect, it } from "vitest";
import { one, query } from "@/lib/db";
import { createOrder, getPayments, handleStripeEvent, nextDue, paidCents, type Order } from "@/lib/payments";
import { rateLimit } from "@/lib/server-utils";
import { freshDb } from "./setup-db";

beforeAll(freshDb);

async function order(total = 150000, deposit = 45000) {
  const o = await createOrder({ customerName: "Label Test", customerEmail: "pay@example.com", clientType: "pro", label: "Clip test", totalCents: total, depositCents: deposit, termsVersion: "t" });
  return (await one<Order>(`SELECT * FROM orders WHERE id = $1`, [o.id]))!;
}

async function paymentFor(o: Order, kind: string, amount: number, session: string) {
  const id = crypto.randomUUID();
  await query(`INSERT INTO payments (id, order_id, kind, amount_cents, stripe_session_id) VALUES ($1,$2,$3,$4,$5)`, [id, o.id, kind, amount, session]);
  return id;
}

function ev(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return { id, type, livemode: false, data: { object } } as unknown as Stripe.Event;
}

describe("échéancier acompte / solde", () => {
  it("demande d'abord l'acompte, puis le solde", async () => {
    const o = await order();
    expect(nextDue(o, [])).toEqual({ kind: "acompte", amount: 45000 });
    await paymentFor(o, "acompte", 45000, "cs_a1");
    await handleStripeEvent(ev("evt_1", "checkout.session.completed", { id: "cs_a1", payment_status: "paid", amount_total: 45000, payment_intent: "pi_1" }));
    const ps = await getPayments(o.id);
    expect(paidCents(ps)).toBe(45000);
    const o2 = (await one<Order>(`SELECT * FROM orders WHERE id = $1`, [o.id]))!;
    expect(o2.status).toBe("acompte_paye");
    expect(nextDue(o2, ps)).toEqual({ kind: "solde", amount: 105000 });

    await paymentFor(o, "solde", 105000, "cs_s1");
    await handleStripeEvent(ev("evt_2", "checkout.session.completed", { id: "cs_s1", payment_status: "paid", amount_total: 105000, payment_intent: "pi_2" }));
    const o3 = (await one<Order>(`SELECT * FROM orders WHERE id = $1`, [o.id]))!;
    expect(o3.status).toBe("paye");
    expect(nextDue(o3, await getPayments(o.id))).toBeNull();
  });

  it("paiement en une fois quand l'acompte vaut 0", async () => {
    const o = await order(80000, 0);
    expect(nextDue(o, [])).toEqual({ kind: "total", amount: 80000 });
  });
});

describe("webhooks", () => {
  it("n'applique qu'une fois un événement rejoué", async () => {
    const o = await order();
    await paymentFor(o, "acompte", 45000, "cs_dup");
    const e = ev("evt_dup", "checkout.session.completed", { id: "cs_dup", payment_status: "paid", amount_total: 45000, payment_intent: "pi_dup" });
    expect(await handleStripeEvent(e)).toBe("processed");
    expect(await handleStripeEvent(e)).toBe("duplicate");
    const n = await one<{ c: string }>(`SELECT count(*) AS c FROM events WHERE name = 'payment_succeeded' AND props->>'payment' = (SELECT id::text FROM payments WHERE stripe_session_id = 'cs_dup')`);
    expect(Number(n?.c)).toBe(1);
  });

  it("refuse un montant qui ne correspond pas à l'échéance", async () => {
    const o = await order();
    await paymentFor(o, "acompte", 45000, "cs_bad");
    expect(await handleStripeEvent(ev("evt_bad", "checkout.session.completed", { id: "cs_bad", payment_status: "paid", amount_total: 100, payment_intent: "pi_bad" }))).toBe("ignored");
    const p = await one<{ status: string }>(`SELECT status FROM payments WHERE stripe_session_id = 'cs_bad'`);
    expect(p?.status).toBe("cree");
  });

  it("gère paiement différé, échec, expiration et remboursement", async () => {
    const o = await order(50000, 0);
    await paymentFor(o, "total", 50000, "cs_sepa");
    await handleStripeEvent(ev("evt_s1", "checkout.session.completed", { id: "cs_sepa", payment_status: "unpaid", amount_total: 50000, payment_intent: "pi_sepa" }));
    expect((await one<{ status: string }>(`SELECT status FROM payments WHERE stripe_session_id = 'cs_sepa'`))?.status).toBe("en_cours");
    await handleStripeEvent(ev("evt_s2", "checkout.session.async_payment_succeeded", { id: "cs_sepa", payment_status: "paid", amount_total: 50000, payment_intent: "pi_sepa" }));
    expect((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [o.id]))?.status).toBe("paye");

    await handleStripeEvent(ev("evt_r1", "charge.refunded", { payment_intent: "pi_sepa", amount_refunded: 20000 }));
    expect((await one<{ status: string; refunded_cents: number }>(`SELECT status, refunded_cents FROM payments WHERE stripe_session_id = 'cs_sepa'`))).toMatchObject({ status: "rembourse_partiel", refunded_cents: 20000 });
    await handleStripeEvent(ev("evt_r2", "charge.refunded", { payment_intent: "pi_sepa", amount_refunded: 50000 }));
    expect((await one<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [o.id]))?.status).toBe("rembourse");

    const o2 = await order(30000, 0);
    await paymentFor(o2, "total", 30000, "cs_exp");
    await handleStripeEvent(ev("evt_x", "checkout.session.expired", { id: "cs_exp", amount_total: 30000 }));
    expect((await one<{ status: string }>(`SELECT status FROM payments WHERE stripe_session_id = 'cs_exp'`))?.status).toBe("expire");
    expect(nextDue((await one<Order>(`SELECT * FROM orders WHERE id = $1`, [o2.id]))!, await getPayments(o2.id))).toEqual({ kind: "total", amount: 30000 });
  });

  it("vérifie la signature Stripe : valide acceptée, falsifiée rejetée", () => {
    const secret = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_sig", type: "checkout.session.completed", data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(Stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_sig");
    expect(() => Stripe.webhooks.constructEvent(payload.replace("evt_sig", "evt_forged"), header, secret)).toThrow();
    expect(() => Stripe.webhooks.constructEvent(payload, header, "whsec_autre")).toThrow();
  });
});

describe("limitation de débit", () => {
  it("bloque au-delà du quota", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("t:key", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
