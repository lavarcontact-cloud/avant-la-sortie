import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Missing } from "@/components/legal";
import { site } from "@/lib/content";

export const metadata: Metadata = { title: "Conditions générales de vente", alternates: { canonical: "/cgv" } };

/** Trame de CGV : la structure est posée, les clauses doivent être rédigées et validées par un avocat. */
export default function Page() {
  return (
    <LegalShell title="Conditions générales de vente">
      <h2>1. Objet</h2>
      <p>Les présentes conditions encadrent les prestations audiovisuelles et photographiques proposées par {site.legal.publisherName} (réalisation, photographie, direction artistique, contenus), commandées via ce site après acceptation d'un devis.</p>
      <h2>2. Devis et commande</h2>
      <p>Chaque prestation fait l'objet d'un devis personnalisé. La commande est formée par l'acceptation du devis et le règlement de l'acompte via le lien de paiement sécurisé.</p>
      <h2>3. Prix et paiement</h2>
      <p>Les prix sont indiqués en euros TTC. {site.legal.vatNote ?? <Missing label="régime de TVA" />}. Un acompte est demandé à la commande, le solde avant la livraison des fichiers définitifs. <Missing label="qualification acompte ou arrhes, pourcentage, échéances" /></p>
      <p>Clients professionnels : <Missing label="pénalités de retard et indemnité forfaitaire de 40 € pour frais de recouvrement" /></p>
      <h2>4. Exécution, report, annulation</h2>
      <p><Missing label="tournage reporté, intempéries, indisponibilité de l'artiste, frais engagés" /></p>
      <h2>5. Livraison et retouches</h2>
      <p><Missing label="délais, formats, nombre d'allers-retours inclus" /></p>
      <h2>6. Droits d'auteur et droit à l'image</h2>
      <p><Missing label="étendue de la cession de droits (supports, territoire, durée), usage portfolio, responsabilité du client pour les autorisations des personnes filmées et la musique synchronisée" /></p>
      <h2>7. Droit de rétractation (clients particuliers)</h2>
      <p>Le client particulier dispose de 14 jours à compter de la conclusion du contrat pour se rétracter, via le <Link href="/retractation">formulaire de rétractation en ligne</Link>. S'il a expressément demandé que la prestation commence avant la fin de ce délai, il doit, en cas de rétractation, payer la part de la prestation déjà fournie ; il perd son droit de rétractation si la prestation a été entièrement exécutée avant la fin du délai. Les remboursements sont effectués sous 14 jours.</p>
      <h2>8. Médiation et litiges</h2>
      <p>En cas de litige, le client particulier peut recourir gratuitement au médiateur de la consommation : {site.legal.mediator ?? <Missing label="nom et coordonnées du médiateur" />}. <Missing label="droit applicable et juridiction" /></p>
    </LegalShell>
  );
}
