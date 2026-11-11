import { NextResponse, type NextRequest } from "next/server";
import { dueSlot, runReport, flagOverdueInvoices, notifyFollowUps, type Slot } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * Tâche planifiée à appeler toutes les heures (Vercel Cron, GitHub Actions, cron-job.org…)
 * avec l'en-tête Authorization: Bearer <CRON_SECRET>.
 * Génère le bilan dont l'horaire (heure de Paris) correspond à l'heure courante.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const forced = req.nextUrl.searchParams.get("slot") as Slot | null;
  const overdue = await flagOverdueInvoices();
  const followUps = await notifyFollowUps();
  const slot = forced && ["morning", "midday", "evening"].includes(forced) ? forced : await dueSlot();
  const report = slot ? await runReport(slot) : { status: "no_slot_this_hour" };
  return NextResponse.json({ ok: true, slot, report: { status: report.status }, overdue, followUps });
}
