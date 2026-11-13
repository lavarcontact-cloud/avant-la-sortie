# Dossier de candidature locataire

Deux pages générées à partir d'un seul fichier de contenu :

| Page | Adresse (une fois sur `main`) | Pour qui |
|---|---|---|
| `index.html` | `/dossier` | Version publique : profil, parcours, références, réalisations, projet de local |
| `proprietaire.html` | `/dossier/proprietaire` | Version propriétaire : tout, plus les pièces du dossier. Non indexée par les moteurs de recherche |
| `dossier-candidature-sebastien-fula-pitu.pdf` | `/dossier/dossier-candidature-sebastien-fula-pitu.pdf` | PDF A4 tiré de la version propriétaire |

## Modifier le contenu

1. Éditer **`dossier/content.js`** (textes, références, galerie, justificatifs).
2. `node dossier/build.js` : régénère les deux pages.
3. `node dossier/pdf.js` : régénère le PDF (nécessite Playwright et Chromium).
4. Commiter et pousser.

### Règles
- Une référence avec `valide: false` n'est **jamais affichée**. Sony Music, Universal Music et Guy2Bezbar y sont en attente : passe `valide: true` seulement après avoir écrit le projet et le rôle exacts.
- Un justificatif n'affiche un lien de téléchargement que si `fichier` pointe vers un fichier présent dans le dépôt. **Ne pas y déposer de pièce personnelle** : ce dépôt est public.
- Un lien de `identite.liens` n'est affiché que si `actif: true`. Le portfolio Adobe est désactivé tant qu'il renvoie vers une page « missing ».
- Images de la galerie : uniquement des projets réels (fichiers de `images/` et `videos/`). Les affiches des vidéos sont dans `dossier/posters/`.

## Données personnelles
L'e-mail et le téléphone affichés sont ceux déjà publiés sur le site principal. Aucune pièce d'identité, aucun justificatif financier, aucune adresse personnelle n'est publié.
