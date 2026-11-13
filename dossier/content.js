/*
  DOSSIER DE CANDIDATURE LOCATAIRE : CONTENU
  ------------------------------------------
  C'est le seul fichier à modifier pour mettre à jour le dossier.
  Après modification : `node dossier/build.js` (régénère les deux pages),
  puis `node dossier/pdf.js` (régénère le PDF).

  Règles de contenu :
  - Uniquement des faits vérifiables. Une référence avec `valide: false`
    n'est JAMAIS affichée : elle attend ta confirmation (projet, rôle exact).
  - Un justificatif n'affiche un lien de téléchargement que si `fichier`
    pointe vers un fichier réellement présent dans le dépôt.
  - Pas de tiret cadratin dans le texte visible, guillemets droits.
*/
const DOSSIER = {
  identite: {
    nom: "Sébastien Fula-Pitu",
    titre: "Réalisateur · Photographe · Producteur audiovisuel",
    accroche: "Un lieu pour faire grandir la création audiovisuelle dans le Val-de-Marne.",
    base: "Originaire de Champigny-sur-Marne, Val-de-Marne",
    resume: "Réalisateur, photographe, cadreur et monteur, je travaille dans la musique et la culture urbaine : clips, photographie de plateau et de presse, direction artistique, interviews et contenus pour les artistes. Je préside aussi LA VAR, média et association loi 1901 ancrés dans le Val-de-Marne.",
    email: "sebastienfp@hotmail.com",
    telephone: "07 53 74 55 00",
    telephoneLien: "+33753745500",
    // Le portfolio Adobe (sebastienfulapitu.myportfolio.com) renvoie actuellement
    // vers une page « missing » d'Adobe : il n'est pas affiché tant qu'il n'est pas remis en ligne.
    liens: [
      { label: "Parcours complet (site)", url: "https://avant-la-sortie.vercel.app", actif: true },
      { label: "Portfolio Adobe", url: "https://sebastienfulapitu.myportfolio.com", actif: false }
    ],
    langues: "Français · anglais professionnel",
    logiciels: ["Premiere Pro", "After Effects", "Photoshop", "Lightroom"]
  },

  hero: {
    video: "/videos/scene-rue-groupe.mp4",
    poster: "/dossier/posters/scene-rue-groupe.jpg",
    legende: "À la caméra sur le tournage de V2V, \"Crapuleux\" (co-réalisation)."
  },

  parcours: [
    { quand: "Lycée", titre: "Premières sessions de production", texte: "Dès la seconde, premières sessions de production musicale, notamment avec Bolemvn." },
    { quand: "2021", titre: "Cofondation d'un studio", texte: "Studio cofondé avec l'artiste ZS au Bois-l'Abbé, à Champigny-sur-Marne. Y sont passés notamment L2B, Rsko, BRK, Didi Trix et Kerchak." },
    { quand: "Image", titre: "Devant puis derrière la caméra", texte: "La rencontre avec Nocolor : d'abord acteur dans des clips, puis photographe de plateau, direction artistique et réalisation." },
    { quand: "Générations", titre: "Six mois comme monteur-réalisateur", texte: "Montage et cadrage d'interviews, contenus éditoriaux, intros et habillages, au studio de Générations. Photographe accrédité pour Générations au festival FCNY." },
    { quand: "Artiste", titre: "Développement de BRK", texte: "Image et branding, choix des réalisateurs et des beatmakers, direction artistique et étalonnage de trois clips. Communauté passée de 8 000 à 10 500 abonnés (+31 %)." },
    { quand: "Aujourd'hui", titre: "Indépendant et président de LA VAR", texte: "Réalisation, photographie, montage et contenus pour des artistes. En parallèle, présidence de LA VAR, association loi 1901, qui envisage de prendre un local pour ses activités." }
  ],

  competences: [
    { titre: "Réalisation de clips", texte: "Écriture, synopsis, moodboard, réalisation et co-réalisation." },
    { titre: "Photographie", texte: "Plateau, presse, portrait et concert." },
    { titre: "Tournage et prise de vues", texte: "Cadrage, plans de tournage, captation d'interviews." },
    { titre: "Montage et postproduction", texte: "Montage de clips, d'interviews et de formats courts." },
    { titre: "Étalonnage", texte: "Ambiances couleur propres à chaque projet." },
    { titre: "Direction artistique", texte: "Covers, univers visuels, choix des équipes créatives." },
    { titre: "Contenus réseaux sociaux", texte: "Formats éditoriaux, habillages, génériques." },
    { titre: "Production et gestion de projet", texte: "Coordination entre artistes, équipes et calendrier de sortie." }
  ],
  materiel: "Matériel audiovisuel : caméras Sony, objectifs, stabilisateurs, systèmes audio et éclairage. Ce qui appartient à l'association et ce qui reste personnel sera précisé par écrit.",

  // Références : uniquement des rôles documentés. `valide: false` = jamais affiché.
  // `structure` (facultatif) : label ou société liée AU PROJET précis, affichée seulement si renseignée.
  // Ex. { nom: "Gazo", role: "...", structure: "Sony Music / Epic Records", valide: true } une fois le projet confirmé.
  references: {
    artistes: [
      { nom: "L2B", role: "Acteur principal du clip \"Noir\". Passé par le studio cofondé en 2021.", valide: true },
      { nom: "Gazo", role: "Acteur dans \"Maybach\" (Landy feat. Gazo). Photographie.", valide: true },
      { nom: "Landy", role: "Acteur dans le clip \"Maybach\". Photographie.", valide: true },
      { nom: "Leto", role: "Direction artistique de la cover \"Enlève tes Pessas\", synopsis écrit pour Nocolor, photo de presse. Cover \"Sauvage\" (Black D feat. Leto).", valide: true },
      { nom: "Timal", role: "Synopsis et moodboard de \"760\", cosignés avec Cherif Nocolor Filho.", valide: true },
      { nom: "Rsko", role: "Passé par le studio cofondé en 2021.", valide: true },
      { nom: "MHD", role: "Acteur dans le clip \"Afro Trap Part. 11\".", valide: true },
      { nom: "BRK", role: "Développement d'artiste, direction artistique et étalonnage de \"Katimini\", \"Everyday\" et \"Flex\".", valide: true },
      { nom: "V2V", role: "Co-réalisation du clip \"Crapuleux\".", valide: true },
      { nom: "Dexter HMC feat. La Hasba", role: "Photographe de plateau et cover de \"91022\".", valide: true },
      { nom: "KLM", role: "Photographie sur le tournage de \"100K\".", valide: true },
      { nom: "Koba LaD, MIG, Jolagreen, Bianca Costa, Bahysa, HLD, Nono La Grinta", role: "Photographie (plateau, presse, concert).", valide: true },
      { nom: "Batbat, Rvfleuze, Bilouki", role: "Photographe de plateau.", valide: true },
      { nom: "Negrito feat. Stavo, Favé", role: "Direction artistique de covers (\"Bala Bala\", \"J'aime pas perdre\").", valide: true },
      { nom: "Guy2Bezbar", role: "À préciser : projet et rôle exacts.", valide: false }
    ],
    structures: [
      { nom: "Générations", role: "Monteur-réalisateur pendant six mois ; photographe accrédité au festival FCNY.", valide: true },
      { nom: "Nocolor", role: "Collaborations en image : acteur, photographe de plateau, direction artistique, co-réalisation.", valide: true },
      { nom: "Sony Music", role: "À préciser : projet, année et nature exacte de la mission.", valide: false },
      { nom: "Universal Music", role: "À préciser : projet, année et nature exacte de la mission.", valide: false }
    ]
  },

  // Galerie : catégories filtrables. `type` image ou video.
  galerie: [
    { type: "video", src: "/videos/scene-rue-groupe.mp4", poster: "/dossier/posters/scene-rue-groupe.jpg", cat: "Tournages", titre: "V2V, \"Crapuleux\"", credit: "Co-réalisation · à la caméra" },
    { type: "video", src: "/videos/dexter-lahasba-bts.mp4", poster: "/dossier/posters/dexter-lahasba-bts.jpg", cat: "Tournages", titre: "Dexter HMC feat. La Hasba, \"91022\"", credit: "Images de tournage" },
    { type: "video", src: "/videos/generations-my-g-avec-jeff.mp4", poster: "/dossier/posters/generations-my-g-avec-jeff.jpg", cat: "Montage", titre: "Générations, \"My G avec Jeff\"", credit: "Cadre, montage et habillage" },
    { type: "video", src: "/videos/brk-katimini-highlights.mp4", poster: "/dossier/posters/brk-katimini-highlights.jpg", cat: "Montage", titre: "BRK, \"Katimini\"", credit: "Direction artistique et étalonnage" },
    { type: "video", src: "/videos/brk-flex-highlights.mp4", poster: "/dossier/posters/brk-flex-highlights.jpg", cat: "Montage", titre: "BRK, \"Flex\"", credit: "Direction artistique et étalonnage" },
    { type: "video", src: "/videos/brk-everyday-highlights.mp4", poster: "/dossier/posters/brk-everyday-highlights.jpg", cat: "Montage", titre: "BRK, \"Everyday\"", credit: "Direction artistique et étalonnage" },
    { type: "image", src: "/images/photo-leto-presse.jpg", cat: "Photographie", titre: "Leto", credit: "Photo de presse" },
    { type: "image", src: "/images/photo-gazo-2.jpg", cat: "Photographie", titre: "Gazo", credit: "Photographie" },
    { type: "image", src: "/images/concert-photo-nono-lagrinta.jpg", cat: "Photographie", titre: "Nono La Grinta", credit: "Concert, Arte Club" },
    { type: "image", src: "/images/klm-100k-photo.jpg", cat: "Photographie", titre: "KLM, \"100K\"", credit: "Sur le tournage" },
    { type: "image", src: "/images/hld-photo-presse.jpg", cat: "Photographie", titre: "HLD", credit: "Photo de presse" },
    { type: "image", src: "/images/photo-koba-lad.jpg", cat: "Photographie", titre: "Koba LaD", credit: "Photographie" },
    { type: "image", src: "/images/photo-bianca-costa.jpg", cat: "Photographie", titre: "Bianca Costa", credit: "Concert" },
    { type: "image", src: "/images/photo-mig.jpg", cat: "Photographie", titre: "MIG", credit: "Photographie" },
    { type: "image", src: "/images/image-photo-bilouki.jpg", cat: "Photographie", titre: "Bilouki, \"Paire assortie\"", credit: "Photographe de plateau" },
    { type: "image", src: "/images/image-photo-rvfleuze.jpg", cat: "Photographie", titre: "Rvfleuze", credit: "Photographe de plateau" },
    { type: "image", src: "/images/image-photo-dexterhmc.jpg", cat: "Photographie", titre: "Dexter HMC feat. La Hasba", credit: "Photographe de plateau" },
    { type: "image", src: "/images/image-cover-leto-pessas.jpg", cat: "Direction artistique", titre: "Leto, \"Enlève tes Pessas\"", credit: "Cover" },
    { type: "image", src: "/images/image-cover-blackd-leto.jpg", cat: "Direction artistique", titre: "Black D feat. Leto, \"Sauvage\"", credit: "Cover" },
    { type: "image", src: "/images/image-cover-negrito-stavo.jpg", cat: "Direction artistique", titre: "Negrito feat. Stavo, \"Bala Bala\"", credit: "Cover" },
    { type: "image", src: "/images/image-cover-fave-five.jpg", cat: "Direction artistique", titre: "Favé, \"J'aime pas perdre\"", credit: "Cover" },
    { type: "image", src: "/images/timal-synopsis-01.jpg", cat: "Direction artistique", titre: "Timal, \"760\"", credit: "Synopsis et moodboard" },
    { type: "image", src: "/images/leto-pessas-synopsis-02.jpg", cat: "Direction artistique", titre: "Leto, \"Enlève tes Pessas\"", credit: "Synopsis écrit pour Nocolor" },
    { type: "video", src: "/videos/l2b-noir-cuts.mp4", poster: "/dossier/posters/l2b-noir-cuts.jpg", cat: "Devant la caméra", titre: "L2B, \"Noir\"", credit: "Acteur principal" },
    { type: "video", src: "/videos/landy-gazo-maybach-cuts.mp4", poster: "/dossier/posters/landy-gazo-maybach-cuts.jpg", cat: "Devant la caméra", titre: "Landy feat. Gazo, \"Maybach\"", credit: "Acteur" }
  ],

  projet: {
    titre: "Un espace de création privatif, calme et encadré.",
    // Argument central, rédigé par Sébastien.
    argument: [
      "Originaire de Champigny-sur-Marne, je souhaite développer un espace de création audiovisuelle au cœur de mon territoire. Mon objectif est de disposer d'un lieu professionnel, entièrement privatif, où je pourrai réaliser des shootings, produire des contenus vidéo, accompagner des artistes et développer des projets culturels.",
      "Ce projet s'appuie sur une expérience concrète dans l'audiovisuel et les musiques urbaines, ainsi que sur le développement de LA VAR, un média et une association ancrés dans le territoire.",
      "Installer cette activité à proximité de Champigny permettrait de faire vivre un espace de création local, de développer des collaborations et de valoriser les talents du département."
    ],
    introCourte: "Un espace de création audiovisuelle privatif, utilisé de façon calme et encadrée : shootings, contenus vidéo, montage, accompagnement d'artistes et projets de LA VAR.",
    locataire: [
      ["Locataire envisagé", "LA VAR, association loi 1901, représentée par son président, Sébastien Fula-Pitu"],
      ["Usage principal", "Création audiovisuelle : shootings photo, contenus vidéo, montage et postproduction, accompagnement d'artistes, projets culturels de LA VAR, stockage du matériel"],
      ["Fonctionnement", "Calme et encadré : en petite équipe, sur rendez-vous, aux horaires convenus avec vous"],
      ["Ce que ce n'est pas", "Ni accueil du public, ni événement, ni studio d'enregistrement professionnel ou cabine"],
      ["Usages complémentaires", "Toute occupation personnelle ou professionnelle complémentaire sera encadrée et soumise à votre autorisation écrite"]
    ],
    fonctions: [
      { titre: "Shootings photo", texte: "Portraits, photos de presse et visuels d'artistes, en petite équipe et sur rendez-vous.", principal: true },
      { titre: "Contenus vidéo", texte: "Interviews, formats courts et contenus pour les artistes et le média de LA VAR.", principal: true },
      { titre: "Montage et postproduction", texte: "Montage, étalonnage et finalisation des projets, sur poste fixe.", principal: true },
      { titre: "Accompagnement d'artistes", texte: "Rendez-vous de travail, préparation de projets, conseil en image : quelques personnes à la fois.", principal: true },
      { titre: "Projets culturels de LA VAR", texte: "Préparation des actions de l'association et de son média autour des talents du département.", principal: true },
      { titre: "Bureau et gestion de projets", texte: "Organisation des tournages, administratif, coordination des équipes.", principal: true },
      { titre: "Stockage sécurisé du matériel", texte: "Caméras, objectifs, stabilisateurs, audio et lumière rangés dans un lieu fermé.", principal: true },
      { titre: "Usage professionnel personnel", texte: "Toute utilisation par Sébastien Fula-Pitu pour son activité personnelle sera encadrée, et seulement si vous l'autorisez par écrit.", principal: false }
    ],
    exclus: ["Événements ou soirées", "Activité nocturne", "Accueil du public", "Flux importants de visiteurs", "Studio d'enregistrement professionnel ou cabine", "Sous-location ou occupation partagée non autorisée par le propriétaire"],
    recherche: [
      ["Secteur", "Champigny-sur-Marne et communes voisines : Chennevières, Le Plessis-Trévise, Villiers-sur-Marne, Bry-sur-Marne, Ormesson, La Queue-en-Brie, Noiseau ; puis Saint-Maur et Joinville"],
      ["Surface", "30 à 60 m², idéalement 40 à 50 m²"],
      ["Type", "Local d'activité, atelier, local professionnel ou commercial, à usage exclusif"],
      ["Budget", "Jusqu'à 800 € TTC par mois, charges comprises"],
      ["Accès", "Accès pratique pour le matériel, stationnement apprécié"]
    ]
  },

  lavar: {
    nom: "LA VAR",
    nomComplet: "Association pour la Réussite, l'Audiovisuel et la Valorisation des Jeunes des Quartiers Prioritaires",
    statut: "Association loi 1901",
    role: "Sébastien Fula-Pitu en est le président.",
    texte: "LA VAR développe des projets autour de l'audiovisuel, de la création de contenu et de la culture urbaine, avec un objectif : accompagner les jeunes des quartiers prioritaires et valoriser leurs talents. Elle anime aussi un média rap et culture urbaine qui met en avant des artistes émergents.",
    axes: ["Audiovisuel", "Création de contenu", "Culture urbaine", "Accompagnement des jeunes", "Valorisation des talents", "Prévention et initiatives locales"],
    // Chiffres du média, relevés dans Instagram Insights en 2026 (repris du site existant).
    chiffres: [
      ["11 365", "abonnés au média"],
      ["100+", "artistes mis en avant"],
      ["105 979", "spectateurs sur 90 jours"]
    ],
    sourceChiffres: "Média Instagram de LA VAR, statistiques relevées en 2026.",
    distinction: "LA VAR est la structure envisagée pour porter initialement la location. Les activités et les finances de l'association restent distinctes de mon activité professionnelle personnelle : le loyer et les charges relèvent de l'association, et toute utilisation du local à titre personnel ou professionnel par son président sera encadrée et soumise à l'accord écrit du propriétaire.",
    visuels: [
      { type: "image", src: "/images/lavar-post-klm.jpg", titre: "Publication LA VAR" },
      { type: "image", src: "/images/lavar-post-creamy.jpg", titre: "Publication LA VAR" },
      { type: "video", src: "/videos/lavar-rnboi-preview.mp4", poster: "/dossier/posters/lavar-rnboi-preview.jpg", titre: "Extrait publié par LA VAR" }
    ],
    logo: "/images/lavar-logo.png"
  },

  engagements: [
    ["Destination respectée", "Utilisation conforme à la destination prévue au bail, pour les activités de l'association."],
    ["Voisinage", "Respect du voisinage et maîtrise des nuisances sonores."],
    ["Parties communes", "Respect des parties communes, des règles d'accès et du règlement de l'immeuble."],
    ["Entretien", "Entretien régulier du local, rangé en permanence."],
    ["Matériel", "Stockage organisé et attention constante à la sécurité des équipements."],
    ["Tournages encadrés", "Shootings et tournages en petite équipe, sur rendez-vous, aux horaires convenus, sans nuisance."],
    ["Assurance", "Assurance adaptée à l'activité et au matériel, souscrite par l'association avant l'entrée dans les lieux."],
    ["Public", "Aucun accueil du public : artistes et collaborateurs reçus sur rendez-vous, en petit comité."],
    ["Usage encadré", "Aucune sous-location ni occupation par un tiers sans votre autorisation écrite."]
  ],

  // Justificatifs : seuls des documents NON sensibles peuvent avoir un lien (public: true + fichier présent).
  // Pièce d'identité, avis d'imposition, relevés bancaires : JAMAIS dans ce dépôt, il est public.
  justificatifs: [
    { nom: "Statuts de LA VAR", statut: "Transmis sur demande", fichier: null, public: false },
    { nom: "Récépissé de déclaration en préfecture (RNA) de LA VAR", statut: "Transmis sur demande", fichier: null, public: false },
    { nom: "Décision du bureau de LA VAR autorisant la prise à bail", statut: "À établir avant la signature", fichier: null, public: false },
    { nom: "Attestation d'assurance de l'association", statut: "Fournie avant l'entrée dans les lieux", fichier: null, public: false },
    { nom: "Éléments financiers de l'association", statut: "Transmis sur demande, directement au bailleur", fichier: null, public: false },
    { nom: "Pièce d'identité du président", statut: "Transmise sur demande, directement au bailleur", fichier: null, public: false }
  ],

  // Versions ciblées pour un site précis. Pas de prix ni d'avance de paiement : ces points se discutent de vive voix.
  cibles: {
    noiseau: {
      page: "noiseau",
      pdf: "/dossier/proposition-occupation-chateau-noiseau-la-var.pdf",
      label: "Proposition d'occupation temporaire · Château de Noiseau",
      titre: "Une occupation temporaire, simple et encadrée.",
      intro: "Le bâtiment du Château, dans la ZAC des Portes de Noiseau, a été ouvert aux associations loi 1901 par l'appel à manifestation d'intérêt de Grand Paris Sud Est Avenir et de la SPLA Avenir Développement. LA VAR souhaite y occuper un petit espace de travail, d'abord pour trois mois.",
      demande: [
        ["Site", "Bâtiment du Château, ZAC des Portes de Noiseau, 34 route de la Queue-en-Brie, Noiseau"],
        ["Occupant", "LA VAR, association loi 1901, représentée par son président, Sébastien Fula-Pitu"],
        ["Surface", "35 à 50 m², un bureau fermé à clé ; si possible un petit espace de stockage en sous-sol"],
        ["Usage", "Bureau associatif, gestion de projets, montage, postproduction et stockage de matériel audiovisuel"],
        ["Public", "Ni accueil du public ni événements dans le local"],
        ["Durée", "Une première période de trois mois, prolongeable par avenant jusqu'à fin 2027 si cela convient à toutes les parties"],
        ["Cadre", "Convention d'occupation temporaire, aux conditions tarifaires du site"],
        ["Démarrage", "Dès que possible, après signature de la convention"]
      ],
      territoire: {
        titre: "Un projet porté par un jeune du territoire",
        paragraphes: [
          "Originaire de Champigny-sur-Marne, dans le Val-de-Marne, je souhaite aujourd'hui développer mon activité et mes engagements associatifs au cœur du territoire qui m'a vu grandir.",
          "À travers LA VAR, association loi 1901 que je préside, je porte un projet autour de l'audiovisuel, de la création, de la valorisation des jeunes et de l'accompagnement des initiatives locales.",
          "L'opportunité de pouvoir installer ce projet à Noiseau, commune voisine de Champigny-sur-Marne, aurait une signification particulière pour moi. Je serais fier de pouvoir contribuer, à mon échelle, à la dynamique de ce territoire et de montrer qu'un jeune issu du Val-de-Marne peut construire des projets, développer une activité et participer à la valorisation de son département.",
          "Mon souhait est de m'inscrire durablement dans cet environnement, en commençant par une occupation temporaire de trois mois, afin de démontrer concrètement le sérieux, la régularité et l'utilité du projet.",
          "Au-delà de la mise à disposition d'un local, je vois cette opportunité comme la possibilité de développer une initiative locale, portée par quelqu'un qui connaît ce territoire et souhaite y construire son avenir."
        ],
        signature: "Sébastien Fula-Pitu, président de LA VAR"
      },
      apports: [
        ["Une présence régulière", "Un bâtiment occupé et entretenu au quotidien, en journée, par une petite équipe identifiée."],
        ["Un usage calme", "Travail de bureau et postproduction : pas de flux de visiteurs, pas de nuisance pour les autres occupants."],
        ["Un projet associatif", "Une association tournée vers l'audiovisuel, la création et la valorisation des jeunes, en cohérence avec l'ouverture du site à l'économie sociale et solidaire."],
        ["Un engagement court et réversible", "Trois mois pour faire ses preuves, sans engagement lourd pour le site, puis une prolongation seulement si elle convient à tous."]
      ]
    }
  },

  pdf: "/dossier/dossier-candidature-sebastien-fula-pitu.pdf"
};
if (typeof module !== "undefined") module.exports = DOSSIER;
