import type { Metadata } from "next";
import { LegalShell, Missing } from "@/components/legal";
import { site } from "@/lib/content";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };

export default function Page() {
  const l = site.legal;
  return (
    <LegalShell title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>{l.publisherName}{l.status ? `, ${l.status}` : <>, <Missing label="statut (EI, micro-entrepreneur...)" /></>}</p>
      <p>Adresse : {l.address ?? <Missing label="adresse (art. 1-1 LCEN)" />}</p>
      <p>Téléphone : {site.contact.phone ?? <Missing label="téléphone" />} · E-mail : <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p>
      <p>SIRET : {l.siret ?? <Missing label="SIRET" />}</p>
      <p>TVA : {l.vatNote ?? <Missing label="numéro de TVA ou mention de franchise (art. 293 B du CGI)" />}</p>
      <p>Directeur de la publication : {l.publisherName}</p>
      <h2>Hébergement</h2>
      <p>{l.host.name}, {l.host.address}. Contact : <a href={l.host.contact}>{l.host.contact}</a>. <Missing label="téléphone de l'hébergeur et coordonnées vérifiées au moment de la mise en ligne" /></p>
      <p>Base de données : <Missing label="prestataire retenu (ex. Supabase, région UE)" /></p>
      <h2>Médiation de la consommation</h2>
      <p>{l.mediator ?? <Missing label="médiateur de la consommation (art. L612-1 C. conso.)" />}</p>
      <h2>Propriété intellectuelle et crédits</h2>
      <p>Les vidéos, photographies et textes de ce site sont la propriété de leurs auteurs et ayants droit. Toute réutilisation est interdite sans autorisation. Si vous apparaissez sur une image et souhaitez son retrait, écrivez à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.</p>
    </LegalShell>
  );
}
