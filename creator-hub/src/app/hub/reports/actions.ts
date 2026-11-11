"use server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { runReport, type Slot } from "@/lib/reports";
import { parisParts } from "@/lib/dates";

export async function generateReportNow(_s?: unknown, _f?: FormData): Promise<{ ok?: string; error?: string }> {
  await requireAuth();
  const h = parisParts(new Date()).hour;
  const slot: Slot = h < 12 ? "morning" : h < 17 ? "midday" : "evening";
  const r = await runReport(slot, true);
  revalidatePath("/hub/reports");
  return { ok: r.status === "generated" ? "Bilan généré" : "Bilan déjà généré" };
}
