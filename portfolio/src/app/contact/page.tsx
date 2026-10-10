import type { Metadata } from "next";
import { CtaLink } from "@/components/cta-link";
import { site } from "@/lib/content";

export const metadata: Metadata = { title: "Contact", description: `Contacter ${site.name}.`, alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-20 sm:pt-24">
      <p className="t-eyebrow">Contact</p>
      <h1 className="t-display mt-2 text-[clamp(40px,7vw,84px)]">Parlons image.</h1>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <CtaLink href="/devis" cta="devis" surface="contact" className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent)]/10 p-6 transition-colors hover:bg-[var(--color-accent)]/20">
          <span className="t-eyebrow block">Un projet précis</span>
          <span className="t-display mt-2 block text-2xl">Demander un devis →</span>
        </CtaLink>
        <CtaLink href={`mailto:${site.contact.email}`} cta="contact_email" surface="contact" className="rounded-2xl border border-[var(--color-line)] p-6 hover:border-[var(--color-fg)]">
          <span className="t-eyebrow block">E-mail</span>
          <span className="t-display mt-2 block break-all text-xl">{site.contact.email}</span>
        </CtaLink>
        {site.contact.phone && site.contact.phoneE164 && (
          <CtaLink href={`tel:${site.contact.phoneE164}`} cta="contact_phone" surface="contact" className="rounded-2xl border border-[var(--color-line)] p-6 hover:border-[var(--color-fg)]">
            <span className="t-eyebrow block">Téléphone</span>
            <span className="t-display mt-2 block text-xl">{site.contact.phone}</span>
          </CtaLink>
        )}
        <div className="rounded-2xl border border-[var(--color-line)] p-6">
          <span className="t-eyebrow block">Basé à</span>
          <span className="t-display mt-2 block text-xl">{site.contact.city}</span>
        </div>
      </div>
    </div>
  );
}
