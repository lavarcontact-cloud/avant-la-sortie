# Dossier de candidature locataire

Deux pages générées à partir d'un seul fichier de contenu :

| Page | Adresse (une fois sur `main`) | Pour qui |
|---|---|---|
| `index.html` | `/dossier` | Version publique : profil, parcours, références, réalisations, projet de local |
| `proprietaire.html` | `/dossier/proprietaire` | Version propriétaire : tout, plus la liste des pièces du dossier (sans aucun document en ligne) |
| `noiseau.html` | `/dossier/noiseau` | Version ciblée Château de Noiseau : proposition d'occupation temporaire de 3 mois (`node dossier/pdf.js noiseau` pour son PDF) |
| `proposition-occupation-chateau-noiseau-la-var.pdf` | `/dossier/proposition-occupation-chateau-noiseau-la-var.pdf` | PDF de la version Noiseau |
| `dossier-candidature-sebastien-fula-pitu.pdf` | `/dossier/dossier-candidature-sebastien-fula-pitu.pdf` | PDF A4 tiré de la version propriétaire |

## Modifier le contenu

1. Éditer **`dossier/content.js`** (textes, références, galerie, justificatifs ; versions ciblées dans `cibles`).
2. `node dossier/build.js` : régénère les deux pages.
3. `node dossier/pdf.js` : régénère le PDF (nécessite Playwright et Chromium).
4. Commiter et pousser.

### Règles
- Une référence avec `valide: false` n'est **jamais affichée**. Sony Music, Universal Music et Guy2Bezbar y sont en attente : passe `valide: true` seulement après avoir écrit le projet et le rôle exacts.
- Champ facultatif `structure` sur une référence : label ou société liée au projet précis (ex. "Sony Music / Epic Records"), affiché à côté du rôle.
- Un justificatif n'affiche un lien de téléchargement que si `public: true` ET que `fichier` pointe vers un fichier présent dans le dépôt. **Ne jamais y déposer de pièce personnelle** (identité, avis d'imposition, relevés bancaires) : ce dépôt est public.
- Un lien de `identite.liens` n'est affiché que si `actif: true`. Le portfolio Adobe est désactivé tant qu'il renvoie vers une page « missing ».
- Images de la galerie : uniquement des projets réels (fichiers de `images/` et `videos/`). Les affiches des vidéos sont dans `dossier/posters/`.

## La version propriétaire n'est pas privée
Elle porte une balise `noindex` (pas de référencement Google), mais **toute personne qui a le lien peut l'ouvrir**. Elle ne contient donc que des informations publiables. Les pièces sensibles se transmettent directement au bailleur (e-mail, remise en main propre), jamais par ce site. Pour une vraie protection, il faudrait un accès par mot de passe côté serveur, qui n'existe pas ici.

## Données personnelles
L'e-mail et le téléphone affichés sont ceux déjà publiés sur le site principal. Aucune pièce d'identité, aucun justificatif financier, aucune adresse personnelle n'est publié.
