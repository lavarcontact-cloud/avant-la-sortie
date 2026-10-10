"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <div className="mx-auto mt-20 max-w-sm">
      <h1 className="t-display text-3xl">Espace privé</h1>
      <form action={action} className="mt-6 grid gap-3">
        <label htmlFor="pw" className="text-sm font-semibold">Mot de passe</label>
        <input id="pw" name="password" type="password" autoComplete="current-password" required className="input" aria-invalid={!!state.error || undefined} aria-describedby={state.error ? "pw-err" : undefined} />
        {state.error && <p id="pw-err" role="alert" className="text-sm text-[#ff9a85]">{state.error}</p>}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Connexion..." : "Se connecter"}</button>
      </form>
    </div>
  );
}
