import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { audit } from "@/lib/audit";

const TABLES = ["sectors", "pipeline_stages", "brands", "contacts", "outreach", "responses", "interactions", "deals", "expenses", "documents", "notifications", "reports", "suppression_list", "inbound_requests", "settings", "audit_log"];

/** Export complet (sauvegarde / portabilité RGPD). */
export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await q(`select * from ${t} order by 1`);
  await audit("data.export");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), version: 1, data: out }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="creator-hub-export-${stamp}.json"`, "cache-control": "no-store" },
  });
}
