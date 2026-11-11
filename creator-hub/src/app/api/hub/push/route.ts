import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  await q(`insert into push_subscriptions (endpoint, keys) values ($1,$2) on conflict (endpoint) do update set keys=excluded.keys`, [parsed.data.endpoint, JSON.stringify(parsed.data.keys)]);
  return NextResponse.json({ ok: true });
}
