import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, formatEuros, type Order, type Payment } from "@/lib/payments";
import { cancelOrder, refundAction } from "../actions";
import { OrderForm } from "../order-form";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const orders = await query<Order>(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
  const payments = await query<Payment>(`SELECT * FROM payments WHERE order_id = ANY($1::uuid[]) ORDER BY created_at`, [orders.map((o) => o.id)]);
  const withdrawals = await query<{ ref: string; order_ref: string | null; name: string; email: string; created_at: Date }>(`SELECT ref, order_ref, name, email, created_at FROM withdrawals ORDER BY created_at DESC LIMIT 50`);

  return (
    <div className="space-y-8">
      <h1 className="t-display text-3xl">Commandes et paiements</h1>
      {sp.erreur && <p role="alert" className="rounded-xl bg-[var(--color-accent)]/12 p-3 text-sm">{sp.erreur}</p>}
      {sp.info && <p role="status" className="rounded-xl bg-[var(--color-ok)]/10 p-3 text-sm">{sp.info}</p>}

      <details className="rounded-2xl border border-[var(--color-line)] p-4">
        <summary className="cursor-pointer font-semibold">Nouvelle commande sans demande de devis</summary>
        <div className="mt-4 max-w-md"><OrderForm /></div>
      </details>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-muted)]">Aucune commande.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const ps = payments.filter((p) => p.order_id === o.id);
            return (
              <li key={o.id} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="t-mono text-xs text-[var(--color-muted)]">{o.ref}</span>
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-sm text-[var(--color-muted)]">{o.customer_name} · {o.client_type}</span>
                  <span className="ml-auto chip !min-h-[28px] text-xs">{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <p className="mt-2 text-sm">Total {formatEuros(o.total_cents)} · acompte {formatEuros(o.deposit_cents)}{o.waiver_at ? ` · exécution immédiate demandée le ${new Date(o.waiver_at).toLocaleString("fr-FR")}` : ""}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">Lien client : <Link className="underline" href={`/paiement/${o.pay_token}`}>/paiement/{o.pay_token.slice(0, 8)}…</Link></p>
                {ps.length > 0 && (
                  <table className="mt-3 w-full text-sm">
                    <tbody>
                      {ps.map((p) => (
                        <tr key={p.id} className="border-t border-[var(--color-line)]">
                          <td className="py-2">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                          <td>{p.kind}</td>
                          <td>{formatEuros(p.amount_cents)}{p.refunded_cents ? ` (−${formatEuros(p.refunded_cents)})` : ""}</td>
                          <td>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}{p.livemode ? "" : " · test"}</td>
                          <td className="text-right">
                            {p.status === "reussi" && (
                              <form action={refundAction} className="flex justify-end gap-2">
                                <input type="hidden" name="paymentId" value={p.id} />
                                <input name="confirm" placeholder="REMBOURSER" aria-label="Tapez REMBOURSER pour confirmer" className="input !min-h-[36px] w-36 !py-1 text-xs" />
                                <button type="submit" className="btn btn-ghost !min-h-[36px] text-xs">Rembourser</button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {o.status === "en_attente_acompte" && ps.every((p) => p.status !== "reussi" && p.status !== "en_cours") && (
                  <form action={cancelOrder} className="mt-3">
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="text-xs text-[var(--color-muted)] underline">Annuler la commande</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="t-eyebrow mb-3">Demandes de rétractation</h2>
        {withdrawals.length ? (
          <ul className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] text-sm">
            {withdrawals.map((w) => <li key={w.ref} className="p-3">{w.ref} · {w.order_ref ?? "sans réf."} · {w.name} &lt;{w.email}&gt; · {new Date(w.created_at).toLocaleString("fr-FR")}</li>)}
          </ul>
        ) : <p className="text-sm text-[var(--color-muted)]">Aucune.</p>}
      </section>
    </div>
  );
}
