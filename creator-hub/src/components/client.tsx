"use client";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/hub/actions";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** Formulaire relié à une server action avec retour d'erreur / succès. */
export function ActionForm({ action, children, className = "", resetOnOk = false, submitLabel, submitClass = "btn btn-primary" }: {
  action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean; submitLabel?: string; submitClass?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnOk) ref.current?.reset(); }, [state, resetOnOk]);
  // Soumission manuelle : évite la remise à zéro automatique de React 19,
  // pour que la saisie soit conservée en cas d'erreur de validation.
  return (
    <form ref={ref} className={className} onSubmit={(e) => {
      e.preventDefault();
      if (pending) return;
      const fd = new FormData(e.currentTarget);
      startTransition(() => formAction(fd));
    }}>
      {children}
      {(submitLabel || state) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {submitLabel && <button type="submit" className={submitClass} disabled={pending}>{pending ? "…" : submitLabel}</button>}
          {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
          {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
        </div>
      )}
    </form>
  );
}

export function Submit({ children, className = "btn btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? "…" : children}</button>;
}

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch {
        const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      }
      setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? "Copié ✓" : label}</button>
  );
}

/** Bouton qui soumet le formulaire parent après confirmation. */
export function ConfirmSubmit({ message, children, className = "btn btn-danger" }: { message: string; children: React.ReactNode; className?: string }) {
  return <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}

/** Select qui soumet automatiquement son formulaire. */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function Disclosure({ label, children, defaultOpen = false }: { label: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="btn btn-ghost">{open ? "Fermer" : label}</button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
