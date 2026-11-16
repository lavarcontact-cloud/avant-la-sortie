"use client";
import { useActionState, useEffect } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const success = Boolean(state?.next);
  useEffect(() => { if (state?.next) window.location.assign(state.next); }, [state]);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
      <input type="hidden" name="next" value={next} />
      <label className="block text-xs font-medium text-zinc-400" htmlFor="password">Mot de passe</label>
      <input id="password" name="password" type="password" required autoFocus autoComplete="current-password"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-accent" />
      {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending || success} className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {success ? "Ouverture…" : pending ? "Connexion…" : "Entrer"}
      </button>
    </form>
  );
}
