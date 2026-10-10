import { POLICY_VERSION } from "@/lib/consent";

/** Champ légal manquant : visible, impossible à oublier avant la mise en ligne. */
export function Missing({ label }: { label: string }) {
  return <span className="placeholder">[à compléter : {label}]</span>;
}

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-20 sm:pt-24">
      <p className="t-eyebrow">Informations légales</p>
      <h1 className="t-display mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-3 text-sm text-[var(--color-warn)]" role="note">
        Document de travail (version {POLICY_VERSION}) à faire valider par un professionnel du droit avant la mise en ligne publique.
      </p>
      <div className="prose-legal mt-6">{children}</div>
    </div>
  );
}
