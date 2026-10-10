"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import { BUDGETS, CLIENT_ROLES, QUOTE_STEPS, quoteInput } from "@/lib/quote";

type Values = Record<string, string>;
const SERVICES = [
  { value: "clip", label: "Réalisation de clip", hint: "Synopsis, tournage, montage" },
  { value: "photo", label: "Photographie", hint: "Portrait, presse, plateau, cover" },
  { value: "direction-artistique", label: "Direction artistique", hint: "Univers, équipe, cohérence" },
  { value: "contenu", label: "Contenus & making-of", hint: "Coulisses, formats verticaux" },
  { value: "autre", label: "Autre chose", hint: "Racontez-moi" },
];

/**
 * Trois étapes courtes plutôt qu'un long formulaire : on valide au fil de
 * l'eau, la progression est visible, et l'étape 1 se fait en un tap.
 * Fonctionne entièrement au clavier ; les erreurs sont annoncées.
 */
export function QuoteForm({ initialService, projectRef, projectTitle }: { initialService?: string; projectRef?: string; projectTitle?: string }) {
  const [step, setStep] = useState(initialService ? 1 : 0);
  const [values, setValues] = useState<Values>({ service: initialService ?? "", projectRef: projectRef ?? "", clientType: "pro", description: "", budget: "", name: "", email: "", role: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const [ref, setRef] = useState("");
  const startedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const liveId = useId();

  useEffect(() => {
    track("quote_step", { step: step + 1 });
    formRef.current?.querySelector<HTMLElement>("[data-step-title]")?.focus();
  }, [step]);

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validateStep = (i: number) => {
    const fields = QUOTE_STEPS[i].fields as readonly string[];
    const shape = quoteInput.pick(Object.fromEntries(fields.map((f) => [f, true])) as never);
    const r = shape.safeParse(values);
    if (r.success) return true;
    const e: Record<string, string> = {};
    for (const iss of r.error.issues) e[String(iss.path[0])] ??= iss.message;
    setErrors(e);
    formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`)?.focus();
    return false;
  };

  const next = () => validateStep(step) && setStep((s) => s + 1);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (step < QUOTE_STEPS.length - 1) return next();
    if (!validateStep(step)) return;
    setStatus("sending");
    setServerError("");
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, website: (formRef.current?.elements.namedItem("website") as HTMLInputElement)?.value ?? "", startedAt: startedAt.current }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          const first = QUOTE_STEPS.findIndex((s) => (s.fields as readonly string[]).some((f) => data.fieldErrors[f]));
          if (first >= 0) setStep(first);
        }
        setServerError(data.error ?? "L'envoi a échoué.");
        setStatus("error");
        return;
      }
      setRef(data.ref);
      setStatus("done");
    } catch {
      setServerError("Connexion impossible. Vérifiez votre réseau et réessayez.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="rise rounded-[28px] border border-[var(--color-line)] bg-[var(--color-panel)] p-8 text-center" role="status">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-ok)]/15 text-[var(--color-ok)]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h2 className="t-display mt-5 text-3xl">Demande envoyée.</h2>
        <p className="mt-2 text-[var(--color-muted)]">Référence <b className="t-mono text-[var(--color-fg)]">{ref}</b>. Sébastien revient vers vous par e-mail à {values.email}.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/flux" className="btn btn-ghost">Retour au flux</Link>
          <Link href="/projets" className="btn btn-ghost">Voir les travaux</Link>
        </div>
      </div>
    );
  }

  const pct = ((step + 1) / QUOTE_STEPS.length) * 100;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="rounded-[28px] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 sm:p-8">
      {/* Progression */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]" role="progressbar" aria-valuemin={1} aria-valuemax={QUOTE_STEPS.length} aria-valuenow={step + 1} aria-label="Progression">
          <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500 ease-[var(--ease-spring)]" style={{ width: `${pct}%` }} />
        </div>
        <span className="t-mono text-xs text-[var(--color-muted)]">{step + 1}/{QUOTE_STEPS.length}</span>
      </div>

      <h2 data-step-title tabIndex={-1} style={{ outline: "none" }} className="t-display mt-6 text-2xl sm:text-3xl">
        {["Qu'est-ce qu'on fait ?", "Parlez-moi du projet.", "Comment vous joindre ?"][step]}
      </h2>
      {projectTitle && <p className="mt-1 text-sm text-[var(--color-muted)]">En lien avec : {projectTitle}</p>}

      {/* Champ piège anti-robots : invisible et ignoré par les lecteurs d'écran. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Site web<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="mt-6">
        {step === 0 && (
          <fieldset>
            <legend className="sr-only">Prestation</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-invalid={!!errors.service} aria-describedby={errors.service ? "err-service" : undefined}>
              {SERVICES.map((s) => (
                <label key={s.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-[border-color,transform] duration-200 active:scale-[0.98] ${values.service === s.value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-line)] hover:border-[var(--color-muted)]"}`}>
                  <input
                    type="radio"
                    name="service"
                    value={s.value}
                    checked={values.service === s.value}
                    onChange={() => { set("service", s.value); setTimeout(() => setStep(1), 180); }}
                    className="mt-1 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-sm text-[var(--color-muted)]">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <FieldError id="err-service" msg={errors.service} />
          </fieldset>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <Field label="Le projet" name="description" error={errors.description} hint="Artiste, morceau, intention, références : tout ce qui aide.">
              <textarea name="description" rows={5} value={values.description ?? ""} onChange={(e) => set("description", e.target.value)} className="input" maxLength={3000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date souhaitée" name="dateWish" optional error={errors.dateWish}>
                <input name="dateWish" value={values.dateWish ?? ""} onChange={(e) => set("dateWish", e.target.value)} placeholder="ex. mi-novembre" className="input" />
              </Field>
              <Field label="Lieu" name="location" optional error={errors.location}>
                <input name="location" value={values.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="ex. Paris, Marseille" className="input" />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Budget</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={errors.budget ? "err-budget" : undefined}>
                {BUDGETS.map((b) => (
                  <label key={b.value} className="chip cursor-pointer" aria-checked={values.budget === b.value}>
                    <input type="radio" name="budget" value={b.value} checked={values.budget === b.value} onChange={() => set("budget", b.value)} className="sr-only" />
                    {b.label}
                  </label>
                ))}
              </div>
              <FieldError id="err-budget" msg={errors.budget} />
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" name="name" error={errors.name}>
                <input name="name" autoComplete="name" value={values.name ?? ""} onChange={(e) => set("name", e.target.value)} className="input" />
              </Field>
              <Field label="E-mail" name="email" error={errors.email}>
                <input name="email" type="email" autoComplete="email" inputMode="email" value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} className="input" />
              </Field>
              <Field label="Téléphone" name="phone" optional error={errors.phone}>
                <input name="phone" type="tel" autoComplete="tel" value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="input" />
              </Field>
              <Field label="Structure" name="company" optional error={errors.company}>
                <input name="company" autoComplete="organization" value={values.company ?? ""} onChange={(e) => set("company", e.target.value)} placeholder="Label, management, marque..." className="input" />
              </Field>
            </div>
            <Field label="Vous êtes" name="role" error={errors.role}>
              <select name="role" value={values.role ?? ""} onChange={(e) => set("role", e.target.value)} className="input">
                <option value="" disabled>Choisir</option>
                {CLIENT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Vous agissez</legend>
              <div className="flex flex-wrap gap-2">
                {[["pro", "À titre professionnel"], ["particulier", "À titre personnel"]].map(([v, l]) => (
                  <label key={v} className="chip cursor-pointer" aria-checked={values.clientType === v}>
                    <input type="radio" name="clientType" value={v} checked={values.clientType === v} onChange={() => set("clientType", v)} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Vos informations servent uniquement à répondre à votre demande et à préparer un devis. Elles sont conservées 3 ans
              au plus sans suite donnée. Vous pouvez y accéder, les rectifier ou les supprimer :{" "}
              <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
            </p>
          </div>
        )}
      </div>

      <div id={liveId} aria-live="assertive" className="mt-4">
        {serverError && <p className="rounded-xl bg-[var(--color-accent)]/12 p-3 text-sm text-[#ffb9a8]">{serverError}</p>}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>Retour</button>
        ) : <span />}
        {step > 0 && (
          <button type="submit" className="btn btn-primary min-w-[140px]" disabled={status === "sending"}>
            {status === "sending" ? "Envoi..." : step === QUOTE_STEPS.length - 1 ? "Envoyer la demande" : "Continuer"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, name, error, hint, optional, children }: { label: string; name: string; error?: string; hint?: string; optional?: boolean; children: React.ReactElement<Record<string, unknown>> }) {
  const errId = `err-${name}`;
  const hintId = `hint-${name}`;
  const child = { ...children, props: { ...children.props, id: `f-${name}`, "aria-invalid": !!error || undefined, "aria-describedby": [error ? errId : "", hint ? hintId : ""].filter(Boolean).join(" ") || undefined } };
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-[var(--color-muted)]">(facultatif)</span>}
      </label>
      {child}
      {hint && <p id={hintId} className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
      <FieldError id={errId} msg={error} />
    </div>
  );
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return <p id={id} className="mt-1.5 text-sm text-[#ff9a85]">{msg}</p>;
}
