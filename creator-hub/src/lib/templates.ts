// Préparation des messages de prospection.
// Personnalisation UNIQUEMENT à partir des champs renseignés et vérifiés sur la fiche.
// Toute information manquante est laissée en [À COMPLÉTER] : rien n'est inventé.
import { COLLAB_TYPES, type CollabType } from "./constants";

export interface TemplateInput {
  brand: { name: string; description?: string | null; sector?: string | null; opportunities?: string[] | null; website?: string | null };
  contact?: { first_name?: string | null; last_name?: string | null; role?: string | null } | null;
  profile: { display_name?: string; signature?: string; media_kit_url?: string; portfolio_url?: string; pitch?: string };
  collabType: CollabType;
  angle?: string; // angle personnalisé saisi par l'utilisateur (actualité, produit précis…)
}

const TODO = (what: string) => `[À COMPLÉTER : ${what}]`;

const IDEAS: Record<CollabType, (b: string) => string> = {
  ugc_paid: (b) => `une série de contenus UGC courts (formats verticaux) mettant en situation un produit ${b}, livrés avec les droits d'usage que vous définissez`,
  gifting: (b) => `recevoir un produit ${b} pour l'intégrer naturellement à mes contenus, avec une mention claire du produit offert`,
  product_test: (b) => `tester un produit ${b} en conditions réelles de tournage et partager un retour honnête selon les conditions convenues`,
  influence: (b) => `une publication sur mes réseaux présentant ${b}, clairement identifiée comme partenariat`,
  ambassador: (b) => `un partenariat récurrent avec ${b} sur plusieurs mois, avec un calendrier de contenus défini ensemble`,
  event: (b) => `couvrir ou activer un événement ${b} (photo, vidéo, contenus à chaud)`,
  production: (b) => `une production photo / vidéo pour ${b}, du concept à la livraison`,
  music: (b) => `une activation reliant ${b} à un projet musical (artiste, sortie, clip ou événement)`,
  strategy: (b) => `un accompagnement création de contenu / stratégie pour ${b}`,
};

export function buildMessages(i: TemplateInput) {
  const b = i.brand.name;
  const firstName = i.contact?.first_name?.trim();
  const hello = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const me = i.profile.display_name?.trim() || TODO("votre nom");
  const pitch = i.profile.pitch?.trim() || TODO("présentation en une phrase (activité, univers)");
  const angle = i.angle?.trim() || TODO(`ce qui vous a réellement donné envie de travailler avec ${b} (produit, campagne, actualité vérifiée)`);
  const idea = IDEAS[i.collabType](b);
  const mk = i.profile.media_kit_url?.trim();
  const pf = i.profile.portfolio_url?.trim();
  const links = [pf && `Portfolio : ${pf}`, mk && `Media Kit : ${mk}`].filter(Boolean).join("\n") || TODO("lien portfolio / Media Kit");
  const sig = i.profile.signature?.trim() || me;
  const typeLabel = COLLAB_TYPES[i.collabType].label;
  const isGift = i.collabType === "gifting" || i.collabType === "product_test";

  const subject = isGift
    ? `${b} × ${me} — proposition de test produit`
    : `${b} × ${me} — proposition ${typeLabel.toLowerCase()}`;

  const email = `${hello}

Je suis ${me}. ${pitch}

${angle}

Je vous propose ${idea}.

${isGift
    ? "Je ne demande aucune rémunération pour cette première étape : l'objectif est de voir si le produit s'intègre vraiment à mon travail. Tout contenu publié mentionnera clairement le produit offert."
    : "Je peux vous envoyer une proposition détaillée (livrables, délais, droits d'usage, budget) si le principe vous intéresse."}

${links}

Si vous n'êtes pas la bonne personne, pourriez-vous m'indiquer qui contacter ? Et si ce n'est pas le moment, je comprends tout à fait.

Belle journée,
${sig}`;

  const instagram = `${hello.replace(",", " !")} Je suis ${me}, ${pitch.charAt(0).toLowerCase() + pitch.slice(1)}
${angle}
J'aimerais vous proposer ${idea}. Je peux vous envoyer les détails par email si ça vous parle ?`;

  const linkedin = `${hello}
${pitch} ${angle}
Je souhaiterais échanger avec vous autour d'une collaboration (${typeLabel.toLowerCase()}) avec ${b}. Seriez-vous la bonne personne pour en parler ?
${sig}`;

  const followUp = `${hello}

Je me permets de revenir vers vous au sujet de mon message concernant ${b} (${typeLabel.toLowerCase()}).

${TODO("élément nouveau et pertinent : contenu récent, disponibilité, idée précise")}

Si le sujet n'est pas d'actualité, un simple mot me suffit et je ne vous relancerai plus.

Belle journée,
${sig}`;

  const ugcIdea = `Idée de campagne UGC — ${b}
• Format : 3 vidéos verticales de 15 à 30 s (hook, démonstration, usage réel)
• Angle : ${angle}
• Livrables : fichiers bruts + versions montées, sous-titres
• Droits d'usage : ${TODO("durée, supports, territoires — à définir avec la marque")}
• Budget : ${TODO("selon grille tarifaire")}`;

  const missing = [email, instagram, linkedin, followUp].join("\n").match(/\[À COMPLÉTER[^\]]*\]/g) ?? [];
  return { subject, email, instagram, linkedin, followUp, ugcIdea, missing: [...new Set(missing)] };
}
