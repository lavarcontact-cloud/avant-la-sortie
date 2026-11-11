import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { q } from "@/lib/db";
import { notify } from "@/lib/audit";
import { checkEthics } from "@/lib/ethics";
import { COLLAB_KEYS } from "@/lib/constants";

const hits = new Map<string, number[]>();

const Schema = z.object({
  company: z.string().trim().min(1).max(200), name: z.string().trim().min(1).max(200), email: z.string().trim().email().max(200),
  collab_type: z.string().max(50).optional().default(""), budget: z.string().max(100).optional().default(""),
  message: z.string().trim().min(10, "Message trop court").max(5000), website: z.string().max(0).optional().default(""), consent: z.literal("on"),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3600000);
  if (list.length >= 5) return NextResponse.json({ error: "Trop de demandes, réessayez plus tard." }, { status: 429 });
  hits.set(ip, [...list, now]);
  const fd = await req.formData();
  const parsed = Schema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" · ") }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot
  const ethics = checkEthics(d.company, d.message);
  if (!ethics.ok) return NextResponse.json({ error: `Désolé, je ne travaille pas avec ce secteur (${ethics.reason}).` }, { status: 422 });
  await q(`insert into inbound_requests (company, name, email, collab_type, budget, message) values ($1,$2,$3,$4,$5,$6)`,
    [d.company, d.name, d.email.toLowerCase(), (COLLAB_KEYS as string[]).includes(d.collab_type) ? d.collab_type : null, d.budget || null, d.message]);
  await notify({ type: "inbound", title: `Nouvelle demande de collaboration — ${d.company}`, body: d.message.slice(0, 140), link: "/hub/notifications", priority: "high" });
  return NextResponse.json({ ok: true });
}
