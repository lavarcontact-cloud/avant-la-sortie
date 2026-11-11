import { LoginForm } from "./form";
import { authConfigured } from "@/lib/session";

export const metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-xl border-[3px] border-accent" />
          <h1 className="font-display text-2xl font-semibold text-white">Business & PR Hub</h1>
          <p className="mt-1 text-sm text-zinc-400">Espace privé</p>
        </div>
        {!authConfigured() && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Accès non configuré. Définissez <code>ADMIN_PASSWORD</code> et <code>SESSION_SECRET</code> (voir README).
          </p>
        )}
        <LoginForm next={next ?? "/hub"} />
      </div>
    </main>
  );
}
