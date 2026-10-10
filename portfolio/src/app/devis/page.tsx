import type { Metadata } from "next";
import { getProject, getService, site } from "@/lib/content";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = {
  title: "Demander un devis",
  description: "Clip, photo, direction artistique, contenus : décrivez votre projet.",
  alternates: { canonical: "/devis" },
};

export default async function DevisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ref = sp.ref?.replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const project = ref ? getProject(ref) : undefined;
  const service = sp.service && getService(sp.service) ? sp.service : undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 pb-10 pt-20 sm:px-8 sm:pt-24 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="t-eyebrow">Devis</p>
        <h1 className="t-display mt-2 text-[clamp(40px,6vw,72px)]">On en parle ?</h1>
        <p className="mt-4 text-[#d9d5cc]">
          Trois questions, une minute. Pour une demande urgente ou simple, l'e-mail fonctionne aussi :{" "}
          <a href={`mailto:${site.contact.email}`} className="underline underline-offset-2">{site.contact.email}</a>.
        </p>
        <ol className="mt-8 space-y-3 text-sm text-[var(--color-muted)]">
          <li><b className="text-[var(--color-fg)]">1.</b> Vous décrivez le projet.</li>
          <li><b className="text-[var(--color-fg)]">2.</b> Sébastien revient vers vous avec une proposition chiffrée.</li>
          <li><b className="text-[var(--color-fg)]">3.</b> Une fois validée, un lien de paiement sécurisé permet de régler l'acompte.</li>
        </ol>
      </div>
      <QuoteForm initialService={service} projectRef={project?.slug ?? (ref?.startsWith("artiste-") ? ref : undefined)} projectTitle={project?.title} />
    </div>
  );
}
