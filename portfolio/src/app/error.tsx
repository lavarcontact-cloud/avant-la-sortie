"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-5 text-center" role="alert">
      <p className="t-mono text-sm text-[var(--color-muted)]">ERREUR DE LECTURE</p>
      <h1 className="t-display mt-4 text-4xl">Quelque chose a coupé.</h1>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">Réessayer</button>
    </div>
  );
}
