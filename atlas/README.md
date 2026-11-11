# ATLAS — dossier de conception

Ce dossier contient la conception d'ATLAS, l'assistant personnel, administratif, juridique et financier de Sébastien.

**Il ne contient pas encore de code applicatif.** Le cahier des charges demande explicitement un audit, une architecture, une roadmap et un chiffrage avant tout développement.

| Fichier | Contenu |
|---|---|
| `CAHIER-DES-CHARGES.md` | Cahier des charges consolidé V1 (modules 01–12) + V2 (modules 13–23), dédoublonné et regroupé |
| `PHASE-0-AUDIT-ARCHITECTURE.md` | Audit, architecture cible, noyau, permissions, moteur d'automatisation, roadmap, coûts, dépendances et limitations |
| `VERIFICATIONS.md` | Chaque affirmation technique ou réglementaire, avec sa source et sa date de vérification |
| `schema/noyau.sql` | Brouillon du schéma relationnel du noyau (non appliqué, à valider) |

## Pourquoi ce dossier est dans le dépôt `avant-la-sortie`

Le dépôt `avant-la-sortie` héberge le site public de candidature (Vercel). ATLAS n'a pas encore de dépôt propre.

- `atlas/` est exclu du déploiement Vercel via `.vercelignore` : rien de ce dossier ne doit être servi publiquement.
- **Recommandation forte :** créer un dépôt **privé** dédié (`atlas`) avant d'écrire la moindre ligne de code ou d'y verser la moindre donnée réelle. Aucune donnée personnelle (CAF, RSA, banque, documents) ne doit jamais être commitée dans un dépôt git, même privé.

## Statut

| Phase | Statut |
|---|---|
| Phase 0 — Audit et conception | **Rédigée, en attente de validation par Sébastien** |
| Phase 1 — Noyau (identité, données, permissions, automatisations, notifications, écran « Aujourd'hui ») | Non commencée |
| Phases suivantes | Voir roadmap |
