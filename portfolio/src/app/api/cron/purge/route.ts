import crypto from "node:crypto";
import { purgeExpired } from "@/lib/analytics/kpi";

/** Purge planifiée (Vercel Cron, voir vercel.json). Protégée par CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await purgeExpired());
}
