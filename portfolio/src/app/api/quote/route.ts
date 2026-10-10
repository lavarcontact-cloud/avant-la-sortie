import crypto from "node:crypto";
import { query } from "@/lib/db";
import { MIN_FILL_MS, quoteInput } from "@/lib/quote";
import { ipKey, json, makeRef, notify, rateLimit, recordServerEvent, sameOrigin } from "@/lib/server-utils";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origine refusée." }, 403);
  if (!(await rateLimit(`quote:${ipKey(req)}`, 5, 3600))) {
    return json({ error: "Trop de demandes envoyées. Réessayez dans une heure, ou écrivez directement par e-mail." }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }
  const parsed = quoteInput.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    // Le champ piège rempli : on répond "OK" sans rien enregistrer (ne pas renseigner le robot).
    if (fieldErrors.website) return json({ ok: true, ref: makeRef("D") });
    return json({ error: "Certains champs sont à corriger.", fieldErrors }, 422);
  }
  const d = parsed.data;
  if (Date.now() - d.startedAt < MIN_FILL_MS) return json({ ok: true, ref: makeRef("D") });

  const ref = makeRef("D");
  await query(
    `INSERT INTO quotes (id, ref, service, project_ref, name, email, phone, company, client_role, client_type, description, date_wish, budget_range, location, utm_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      crypto.randomUUID(), ref, d.service, d.projectRef || null, d.name, d.email.toLowerCase(), d.phone || null,
      d.company || null, d.role, d.clientType, d.description, d.dateWish || null, d.budget, d.location || null,
      new URL(req.headers.get("referer") ?? "http://x").searchParams.get("utm_source"),
    ],
  );
  await recordServerEvent("quote_submitted", { ref, service: d.service, budget: d.budget, role: d.role, clientType: d.clientType, projectRef: d.projectRef || null });
  await notify(
    `Nouvelle demande de devis ${ref} (${d.service})`,
    `${d.name} <${d.email}>${d.phone ? `, ${d.phone}` : ""}\n${d.role}${d.company ? `, ${d.company}` : ""} (${d.clientType})\nBudget : ${d.budget}\nDate : ${d.dateWish || "-"}\nLieu : ${d.location || "-"}\nRéférence : ${d.projectRef || "-"}\n\n${d.description}`,
  );
  return json({ ok: true, ref });
}
