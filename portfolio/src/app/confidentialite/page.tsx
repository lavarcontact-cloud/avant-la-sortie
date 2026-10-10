import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Missing } from "@/components/legal";
import { site } from "@/lib/content";

export const metadata: Metadata = { title: "Confidentialité", alternates: { canonical: "/confidentialite" } };

const ROWS = [
  ["Répondre aux demandes de devis", "Mesures précontractuelles (art. 6.1.b RGPD)", "Nom, e-mail, téléphone (facultatif), structure, description du projet", "3 ans après le dernier contact sans suite"],
  ["Gérer les commandes et paiements", "Exécution du contrat ; obligations légales comptables", "Identité, e-mail, montants, statut de paiement (aucune donnée de carte)", "Durée de la relation, puis 10 ans pour les pièces comptables"],
  ["Rétractation", "Obligation légale (C. conso.)", "Nom, e-mail, référence de commande", "Durée de prescription applicable"],
  ["Mesure d'audience", "Consentement", "Pages vues, lectures vidéo, clics, identifiant aléatoire, type d'appareil, pays", "13 mois pour l'identifiant, 25 mois pour les statistiques"],
  ["Preuve de vos choix de cookies", "Obligation légale (art. 82 loi Informatique et Libertés)", "Identifiant aléatoire, choix, version, date", "25 mois"],
  ["Sécurité et prévention des abus", "Intérêt légitime", "Empreinte non réversible de l'adresse IP, compteur de requêtes", "24 heures"],
];

export default function Page() {
  return (
    <LegalShell title="Politique de confidentialité">
      <h2>Responsable du traitement</h2>
      <p>{site.legal.publisherName}, joignable à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.</p>
      <h2>Ce que nous traitons, pourquoi, et combien de temps</h2>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted)]"><tr><th className="p-2">Finalité</th><th className="p-2">Base légale</th><th className="p-2">Données</th><th className="p-2">Durée</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r[0]} className="border-t border-[var(--color-line)] align-top">{r.map((c, i) => <td key={i} className="p-2">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p>Aucune donnée n'est vendue ni utilisée pour de la publicité. Aucune prospection commerciale n'est envoyée sans votre accord.</p>
      <h2>Destinataires et sous-traitants</h2>
      <ul>
        <li>Hébergement du site : {site.legal.host.name} (États-Unis). Transfert encadré par le cadre de protection des données UE / États-Unis ou des clauses contractuelles types. <Missing label="vérifier la certification DPF de chaque prestataire" /></li>
        <li>Base de données : <Missing label="prestataire et région" /></li>
        <li>Paiement : Stripe Payments Europe Ltd. Vos données de carte sont saisies chez Stripe et ne transitent pas par ce site.</li>
        <li>E-mails de notification : <Missing label="prestataire d'e-mail s'il est activé" /></li>
      </ul>
      <h2>Mesure d'audience</h2>
      <p>Elle n'est activée qu'avec votre accord. Les statistiques sont produites sur nos propres serveurs, ne sont croisées avec aucun autre traitement et ne sont transmises à aucun tiers. Vous pouvez retirer votre accord à tout moment via le lien "Cookies" en bas de chaque page : les identifiants enregistrés dans votre navigateur sont alors effacés. Voir la <Link href="/cookies">politique cookies</Link>.</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, et pouvez définir des directives sur le sort de vos données après votre décès. Écrivez à <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>. Vous pouvez aussi introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" rel="noopener noreferrer">cnil.fr</a>).</p>
      <h2>Sécurité</h2>
      <p>Connexions chiffrées (HTTPS), accès d'administration protégé par mot de passe et session signée, limitation des envois de formulaires, en-têtes de sécurité, aucune donnée bancaire stockée.</p>
    </LegalShell>
  );
}
