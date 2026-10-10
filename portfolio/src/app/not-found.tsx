import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="t-mono text-sm text-[var(--color-muted)]">404 · PLAN COUPÉ AU MONTAGE</p>
      <h1 className="t-display mt-4 text-4xl">Cette page n'existe pas.</h1>
      <div className="mt-6 flex gap-2"><Link href="/" className="btn btn-primary">Accueil</Link><Link href="/flux" className="btn btn-ghost">Le flux</Link></div>
    </div>
  );
}
