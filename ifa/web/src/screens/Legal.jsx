import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';

// Textes de travail, rédigés pour être lisibles par un public de 12 ans et plus.
// À faire valider par un juriste avant la mise en ligne publique : les champs
// entre crochets doivent être complétés par l'éditeur réel du service.
const PAGES = {
  confidentialite: {
    title: 'Confidentialité',
    body: (
      <>
        <p className="lede">Version courte : on collecte le minimum, on ne vend rien, on ne fait pas de pub ciblée, et tu peux tout supprimer quand tu veux.</p>
        <h3>Qui est responsable ?</h3>
        <p>[Éditeur du service : raison sociale, adresse, e-mail de contact et du référent données personnelles, à compléter avant la mise en ligne.]</p>
        <h3>Ce qu'on collecte, et pourquoi</h3>
        <ul>
          <li><b>E-mail et mot de passe</b> (chiffré) : pour ton compte.</li>
          <li><b>Pseudo, avatar, bio</b> : pour ton profil public. Pas de vrai nom demandé, pas de photo de profil.</li>
          <li><b>Mois et année de naissance</b> : pour appliquer les règles selon l'âge (accord parental, horaires des notifications). Jamais affichés.</li>
          <li><b>E-mail d'un parent</b> si tu as moins de 15 ans : uniquement pour lui demander son accord.</li>
          <li><b>Ce que tu publies</b> (créations, commentaires, réactions, votes) et tes réglages.</li>
          <li><b>Statistiques agrégées</b> : nombre de vues par contenu et nombre de personnes actives par jour. Pas de profil publicitaire, pas de traceur tiers.</li>
        </ul>
        <h3>Base légale</h3>
        <p>L'exécution du service que tu demandes en créant un compte. Pour les moins de 15 ans, l'accord conjoint de l'utilisateur et d'un titulaire de l'autorité parentale (article 45 de la loi Informatique et Libertés). Les notifications push reposent sur ton consentement, retirable à tout moment.</p>
        <h3>Combien de temps ?</h3>
        <ul>
          <li>Compte : tant que tu l'utilises. Suppression immédiate si tu le demandes.</li>
          <li>Compte sans accord parental : supprimé automatiquement au bout de 30 jours.</li>
          <li>Sessions de connexion : 30 jours.</li>
          <li>Signalements et journal de modération : 12 mois, pour pouvoir traiter les récidives et répondre aux autorités.</li>
        </ul>
        <h3>Qui y a accès ?</h3>
        <p>L'équipe d'Ifa, selon les rôles (les modérateurs ne voient pas les e-mails) et nos prestataires techniques : hébergement [à compléter], envoi d'e-mails [à compléter], services de notification des navigateurs (Apple, Google, Mozilla) qui ne reçoivent que le contenu chiffré des notifications.</p>
        <h3>Tes droits</h3>
        <p>Accès, rectification, effacement, portabilité, opposition. Export et suppression sont directement dans <Link className="link" to="/moi/confidentialite">Moi → Confidentialité</Link>. Pour le reste : [e-mail de contact]. Tu peux aussi saisir la CNIL (cnil.fr).</p>
      </>
    ),
  },
  charte: {
    title: 'Charte de la communauté',
    body: (
      <>
        <p className="lede">Fréquence, c'est l'endroit où on partage la musique d'Ifa et ce qu'elle nous inspire. Pour que ça reste un bon endroit pour tout le monde, y compris les plus jeunes :</p>
        <ol>
          <li><b>Respect.</b> Pas d'insulte, de moquerie, de harcèlement, de propos racistes, sexistes, homophobes ou discriminants.</li>
          <li><b>Pas de coordonnées.</b> Ne partage jamais ton numéro, ton adresse, ton école ou ton pseudo d'une autre appli, et ne demande pas ceux des autres.</li>
          <li><b>Pas de rendez-vous privés.</b> Les seules rencontres sont les événements officiels annoncés par l'équipe d'Ifa, encadrés et ouverts selon l'âge.</li>
          <li><b>Ta création, tes droits.</b> Publie ce que tu as fait toi-même. Les personnes visibles doivent être d'accord.</li>
          <li><b>Ifa, c'est le badge ✓.</b> Seuls les comptes vérifiés parlent au nom d'Ifa. Personne de l'équipe ne te demandera de l'argent, une photo ou un échange privé.</li>
          <li><b>Pas de fausses infos.</b> Une rumeur n'est pas une annonce. Les infos officielles portent le badge ✓.</li>
        </ol>
        <h3>Ce qui se passe si la charte n'est pas respectée</h3>
        <p>Contenu retiré, puis suspension du compte en cas de récidive ou de faute grave. Les menaces et les contenus illégaux peuvent être transmis aux autorités (signalement PHAROS).</p>
        <h3>Besoin d'aide ?</h3>
        <p>Signale avec le drapeau sur chaque contenu. Harcèlement : <b>3018</b> (gratuit, anonyme, 7j/7). Danger immédiat : <b>17</b> ou <b>112</b>.</p>
      </>
    ),
  },
  conditions: {
    title: 'Conditions d\'utilisation et de publication',
    body: (
      <>
        <h3>Le service</h3>
        <p>Fréquence est l'espace numérique officiel de l'artiste Ifa, édité par [éditeur à compléter]. Il est gratuit et ouvert à partir de 12 ans, avec l'accord d'un parent en dessous de 15 ans.</p>
        <h3>Contenus officiels et avant-premières</h3>
        <p>Les musiques, vidéos, images et textes publiés par Ifa et son équipe sont protégés. Les contenus du Labo (extraits inédits, avant-premières) sont réservés à une écoute dans l'application : les enregistrer, les filmer ou les rediffuser est interdit et peut entraîner la suppression du compte.</p>
        <h3>Tes créations</h3>
        <ul>
          <li>Tu restes propriétaire de ce que tu publies.</li>
          <li>Tu autorises gratuitement Fréquence et l'équipe d'Ifa à afficher ta création dans l'application et à la mettre en avant (sélection), pendant toute la durée de sa publication. Toute autre utilisation (réseaux sociaux d'Ifa, clip, campagne) te sera demandée à part, avec l'accord d'un parent si tu es mineur.</li>
          <li>Tu garantis avoir les droits sur ce que tu publies et l'accord des personnes visibles.</li>
          <li>Les playbacks et reprises utilisent la musique d'Ifa dans le cadre prévu par l'équipe ; une musique d'un autre artiste peut entraîner le refus de la création.</li>
          <li>Tu peux supprimer ta création à tout moment.</li>
        </ul>
        <h3>Modération</h3>
        <p>Chaque création est vérifiée avant publication. Les commentaires sont filtrés automatiquement puis modérés sur signalement. En cas de refus, le motif t'est indiqué.</p>
        <h3>Contact</h3>
        <p>[E-mail de contact à compléter]</p>
      </>
    ),
  },
};

export function Legal() {
  const { page } = useParams();
  const p = PAGES[page] || PAGES.conditions;
  return (
    <div className="page legal">
      <Link to="/moi" className="mono muted row" style={{ gap: 4, marginBottom: 16 }}><Icon name="back" size={14} /> Retour</Link>
      <h1 className="display h2" style={{ marginBottom: 18 }}>{p.title}</h1>
      <div style={{ fontSize: 16 }}>{p.body}</div>
      <p className="mono dim" style={{ marginTop: 28 }}>Version 2026-10 · document de travail à valider juridiquement</p>
    </div>
  );
}
