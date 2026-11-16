import { LoginForm } from "./form";
import { authConfigured } from "@/lib/session";

export const metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grain relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_70%_20%,rgba(255,91,60,.25),transparent_70%)]" />
      <div className="rise relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent"><span className="h-4 w-4 rounded-full border-[3px] border-ink" /></div>
          <h1 className="font-display text-2xl font-semibold text-white">Business & PR Hub</h1>
          <p className="mt-1 text-sm text-zinc-400">Espace privé</p>
        </div>
        {!authConfigured() && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Accès non configuré. Définissez <code>ADMIN_PASSWORD</code> et <code>DATABASE_URL</code> (voir README).
          </p>
        )}
        <LoginForm next={next ?? "/hub"} />
      </div>
    </main>
  );
}
