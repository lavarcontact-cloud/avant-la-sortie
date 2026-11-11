import { q } from "./db";

export async function audit(action: string, entity?: string, entityId?: number | null, details?: Record<string, unknown>) {
  try {
    await q(`insert into audit_log (action, entity, entity_id, details) values ($1,$2,$3,$4)`, [action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null]);
  } catch (e) {
    console.error("audit failed", e);
  }
}

export async function notify(n: { type: string; title: string; body?: string; brandId?: number | null; link?: string; priority?: "low" | "normal" | "high" }) {
  await q(`insert into notifications (type, title, body, brand_id, link, priority) values ($1,$2,$3,$4,$5,$6)`,
    [n.type, n.title, n.body ?? null, n.brandId ?? null, n.link ?? null, n.priority ?? "normal"]);
  // Push : voir src/lib/push.ts (actif uniquement si les clés VAPID sont configurées).
  try {
    const { sendPushToAll } = await import("./push");
    await sendPushToAll({ title: n.title, body: n.body ?? "", url: n.link ?? "/hub/notifications" });
  } catch (e) {
    console.error("push failed", e);
  }
}
