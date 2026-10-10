"use client";

import { useActionState, useState } from "react";
import { createOrderAction } from "./actions";

type Q = { id?: string; name?: string; email?: string; clientType?: "pro" | "particulier"; label?: string };

export function OrderForm({ quote = {} }: { quote?: Q }) {
  const [state, action, pending] = useActionState(createOrderAction, {});
  const [copied, setCopied] = useState(false);
  const link = state.link ? `${typeof location !== "undefined" ? location.origin : ""}${state.link}` : null;

  if (link) {
    return (
      <div className="rounded-xl border border-[var(--color-ok)]/40 bg-[var(--color-ok)]/10 p-4 text-sm" role="status">
        <p className="font-semibold">Commande créée. Lien de paiement à envoyer au client :</p>
        <p className="mt-2 break-all t-mono text-xs">{link}</p>
        <button type="button" className="btn btn-ghost mt-3" onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>{copied ? "Copié" : "Copier le lien"}</button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-2 text-sm">
      <input type="hidden" name="quoteId" value={quote.id ?? ""} />
      <label className="text-xs font-semibold">Client<input name="customerName" defaultValue={quote.name} required className="input mt-1" /></label>
      <label className="text-xs font-semibold">E-mail<input name="customerEmail" type="email" defaultValue={quote.email} required className="input mt-1" /></label>
      <label className="text-xs font-semibold">Type
        <select name="clientType" defaultValue={quote.clientType ?? "pro"} className="input mt-1"><option value="pro">Professionnel</option><option value="particulier">Particulier (droit de rétractation)</option></select>
      </label>
      <label className="text-xs font-semibold">Intitulé de la prestation<input name="label" defaultValue={quote.label} required className="input mt-1" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">Total TTC (€)<input name="total" inputMode="decimal" required placeholder="1500" className="input mt-1" /></label>
        <label className="text-xs font-semibold">Acompte (€)<input name="deposit" inputMode="decimal" required placeholder="450" className="input mt-1" /></label>
      </div>
      {state.error && <p role="alert" className="text-[#ff9a85]">{state.error}</p>}
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>{pending ? "Création..." : "Créer la commande"}</button>
      <p className="text-[11px] text-[var(--color-muted)]">Montants validés par vous uniquement. Acompte 0 = paiement en une fois.</p>
    </form>
  );
}
