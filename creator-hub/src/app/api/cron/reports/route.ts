import { NextResponse, type NextRequest } from "next/server";
import { dueSlot, runReport, flagOverdueInvoices, notifyFollowUps, type Slot } from "@/lib/reports";
import { runWatch, DEFAULT_WATCH, type WatchSettings } from "@/lib/watch/engine";
import { getProvider } from "@/lib/watch/providers";
import { snapshotForecasts } from "@/lib/forecast/service";
import { getSetting } from "@/lib/settings";
import { parisParts, todayParis } from "@/lib/dates";
import { notify } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tâche planifiée à appeler toutes les heures (GitHub Actions fourni, Vercel Cron, cron-job.org…)
 * avec l'en-tête Authorization: Bearer <CRON_SECRET>. Chaque étape est idempotente :
 *  - factures en retard, relances du jour ;
 *  - prévision du jour archivée (une fois par jour) ;
 *  - veille commerciale (une fois par jour, à l'heure configurée, si une source est configurée) ;
 *  - bilan matin / midi / soir à l'heure configurée.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const out: Record<string, unknown> = {};
  out.overdue = await flagOverdueInvoices();
  out.followUps = await notifyFollowUps();
  out.forecast = (await snapshotForecasts()).status;

  const watch = await getSetting<WatchSettings>("watch", DEFAULT_WATCH);
  const last = await getSetting<{ date: string | null }>("watch_last_run", { date: null });
  const forceWatch = sp.get("watch") === "1";
  if (forceWatch || (watch.enabled && getProvider() && parisParts(new Date()).hour === watch.hour && last.date !== todayParis())) {
    const r = await runWatch("cron");
    out.watch = r.status;
    if (r.status === "done" && ((r as any).new_brands || (r as any).new_contacts)) {
      await notify({ type: "watch", title: `Veille : ${(r as any).new_brands} nouvelle(s) marque(s), ${(r as any).new_contacts} interlocuteur(s)`, link: "/hub/watch?status=new&new=today" });
    }
  } else out.watch = getProvider() ? "not_this_hour" : "no_provider";

  const forced = sp.get("slot") as Slot | null;
  const slot = forced && ["morning", "midday", "evening"].includes(forced) ? forced : await dueSlot();
  out.slot = slot;
  out.report = slot ? (await runReport(slot)).status : "no_slot_this_hour";
  return NextResponse.json({ ok: true, ...out });
}
