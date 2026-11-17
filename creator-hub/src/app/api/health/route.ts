import { loadDataset } from "@/lib/data";
import { computeAll } from "@/lib/forecast/service";
import { unreadCount } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Vérification de santé publique : exécute la même charge base de données que le tableau de bord
 * et ne renvoie QUE des durées (aucune donnée métier).
 */
export async function GET() {
  const t0 = Date.now();
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const s = Date.now();
    try { await fn(); return { name, ok: true, ms: Date.now() - s }; }
    catch (e) { return { name, ok: false, ms: Date.now() - s, error: String((e as Error).message ?? e).slice(0, 160) }; }
  };
  const steps = await Promise.all([step("layout", () => unreadCount()), step("dataset", () => loadDataset()), step("forecast", () => computeAll())]);
  const ok = steps.every((s) => s.ok);
  return Response.json({ ok, ms: Date.now() - t0, steps }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
