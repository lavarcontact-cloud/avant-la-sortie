import type { Metadata } from "next";
import { ManageCookiesButton } from "@/components/consent";
import { LegalShell } from "@/components/legal";

export const metadata: Metadata = { title: "Cookies", alternates: { canonical: "/cookies" } };

const ROWS = [
  ["sfp_consent", "Ce site", "Mémoriser vos choix de cookies", "Nécessaire", "6 mois"],
  ["sfp_admin", "Ce site", "Session de l'espace privé (administrateur uniquement)", "Nécessaire", "8 heures"],
  ["sfp_sid (stockage de session)", "Ce site", "Regrouper les pages vues d'une même visite", "Mesure d'audience", "Fermeture de l'onglet"],
  ["sfp_vid (stockage local)", "Ce site", "Compter les visiteurs sans les identifier", "Mesure d'audience", "13 mois, non prolongé"],
  ["sfp_internal (stockage local)", "Ce site", "Exclure les visites de l'administrateur des statistiques", "Nécessaire", "Jusqu'à suppression"],
];

export default function Page() {
  return (
    <LegalShell title="Cookies et traceurs">
      <p>Ce site n'utilise aucun cookie publicitaire, aucun pixel de réseau social et aucun lecteur vidéo tiers. Les seuls traceurs facultatifs servent à la mesure d'audience interne, et ne sont déposés qu'après votre accord.</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal)">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted)]"><tr><th className="p-2">Nom</th><th className="p-2">Émetteur</th><th className="p-2">Finalité</th><th className="p-2">Catégorie</th><th className="p-2">Durée</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r[0]} className="border-t border-[var(--color-line)] align-top">{r.map((c, i) => <td key={i} className="p-2">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <h2>Changer d'avis</h2>
      <p>Votre choix est conservé 6 mois, puis redemandé. Vous pouvez le modifier à tout moment :</p>
      <ManageCookiesButton className="btn btn-primary" />
      <p>Lors du paiement, vous êtes redirigé vers Stripe (checkout.stripe.com), qui dépose ses propres cookies nécessaires à la sécurité du paiement, sous sa responsabilité.</p>
    </LegalShell>
  );
}
