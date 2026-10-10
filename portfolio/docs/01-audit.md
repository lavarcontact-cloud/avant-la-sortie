# 01 · Rapport d'audit initial

Date : 9-10 octobre 2026. Branche de travail : `claude/portfolio-v1`.

## 1. État réel du dépôt

Le dépôt `lavarcontact-cloud/avant-la-sortie` ne contenait **pas** de portfolio en cours, mais le site de candidature **"Avant la sortie"** (poste Talent Manager A&R Studios, Universal Music France) :

| Élément | Constat |
|---|---|
| `index.html` | page unique de 86 Ko, 2 081 lignes, HTML/CSS/JS inline, GSAP 3.12.5 via CDN, Google Fonts (Bricolage Grotesque, Inter, Space Mono) |
| `images/` (30 fichiers, 2,9 Mo) | photos réelles : plateaux, portraits, covers, synopsis, La Var. **26 sur 44 médias ne sont pas utilisés** par `index.html` |
| `videos/` (13 fichiers, 28 Mo) | extraits H.264 de 5 à 76 s, 480 à 640 px de large. **8 sur 13 ont l'index MP4 en fin de fichier** (le navigateur doit tout télécharger avant de lire) |
| `vercel.json` | `cleanUrls`, déployé sur le projet Vercel `avant-la-sortie` |
| `HANDOFF.md` | historique de passation, avec l'avertissement explicite que ce fichier a déjà été régénéré avec des statuts "câblé" faux |
| `.claude/serve.ps1` | serveur statique PowerShell : l'environnement de Sébastien est sous Windows |
| Historique | 35 commits, août 2026, tous de Sébastien |

**Décision structurante** : le site de candidature est en ligne et a une autre finalité (recrutement). Il n'est **pas modifié**. Le portfolio est construit dans `portfolio/`, application autonome déployable comme un second projet Vercel (Root Directory = `portfolio`). Les médias sont copiés : les fichiers identiques ne grossissent pas le dépôt (git déduplique les contenus), sauf les 8 vidéos remuxées en "faststart" et les nouvelles versions WebM.

## 2. Faits professionnels vérifiables trouvés dans le dépôt

Source unique utilisée : `index.html` et `HANDOFF.md`. Rien d'autre n'a été inventé.

- Studio cofondé en 2021 avec ZS au Bois-l'Abbé (Champigny, 94). Sont passés par ce studio : L2B, Rsko, BRK, Didi Trix, Kerchak, ZS.
- L2B "Noir" : acteur principal. Landy ft. Gazo "Maybach" et MHD : apparitions à l'écran.
- Leto "Enlève tes Pessas" : photographie, DA image, synopsis (pour Cherif Nocolor). V2V "Crapuleux" : co-réalisation. Timal "760" : synopsis et moodboard.
- BRK : développement artistique, DA et étalonnage de Katimini, Everyday, Flex ; 8 000 à 10 500 abonnés (+31 %).
- Dexter HMC ft. La Hasba "91022" : images de tournage et photo de plateau. Festival FCNY : photographe accrédité pour Générations (La Mano 1.9).
- La Var : média créé par Sébastien, 11 365 abonnés, 100+ artistes, 105 979 spectateurs sur 90 jours (au 28/08/2026).

**Écarts avec le brief, à trancher par Sébastien :**
- **Guy2Bezbar** est cité dans le brief mais n'apparaît nulle part dans le dépôt. Non publié tant qu'une source n'est pas fournie.
- **Gazo** : le dépôt documente une apparition dans le clip de Landy ft. Gazo et contient un portrait (`photo-gazo-2.jpg`) dont l'auteur n'est pas documenté. La relation est formulée exactement ainsi.
- **RSKO** : documenté comme "passé par le studio", sans projet image. Il n'a donc pas de bulle dédiée.
- 9 portraits (Gazo, Koba LaD, Landy, Bianca Costa, Jolagreen, MIG, Duo Bahysa, Leto presse, photo de concert) n'ont **aucune information de paternité**. La photo de concert s'appelle `nono-lagrinta`, alors que HANDOFF parle d'Ashe22.
- Les rôles exacts sur les 4 covers ne sont pas précisés ("covers DA").

## 3. Technologies et ressources détectées dans l'environnement

| Ressource | Disponible | Utilisée |
|---|---|---|
| Node 22, npm, pnpm | oui | oui |
| ffmpeg (libx264, libvpx-vp9, libaom-av1) | oui | oui : affiches, faststart, encodage WebM |
| Chromium + Playwright (rév. 1194) | oui | oui : captures, tests E2E, Lighthouse |
| PostgreSQL 16 local | oui (arrêté, démarré pour les tests) | oui : base de dev et de test |
| Registre npm | accessible | oui |
| Accès web (curl) vers cnil.fr | bloqué par le proxy (403) | contourné via Firecrawl pour la recherche |
| `gh` CLI | non | sans objet |
| Vercel CLI | non installé | non requis (MCP Vercel disponible) |

## 4. Skills, sous-agents et connecteurs

**Sous-agents utilisés réellement (2, en parallèle)** :
1. Directeur artistique + recherche UX : 16 références chargées, `docs/02-recherche-references.md`.
2. Conformité + analytics + paiement : sources officielles (CNIL, Légifrance, Service-Public, Stripe, PayPal), `docs/05` et `docs/06`.

Les 12 rôles du brief n'ont pas été lancés comme 12 agents : cela aurait multiplié le coût sans gain. Les rôles PM, UX, front, back, motion, vidéo, SEO, QA et responsable technique ont été tenus dans la session principale, avec des passes distinctes (voir rapport final).

**Skill chargé et appliqué** : `dataviz`, avant le tableau de bord. Le script de validation de palette a été exécuté sur l'accent corail : contraste suffisant sur la surface sombre. Le contrôle "bande de luminosité" échoue, mais il ne s'applique qu'aux palettes catégorielles, d'où l'usage d'une seule série par graphique.

**Connecteurs (MCP)** :

| Connecteur | État | Usage |
|---|---|---|
| Vercel | connecté | lecture seule : 9 projets, dont `avant-la-sortie`. Aucun déploiement effectué |
| Supabase | connecté | lecture seule : 2 projets existants (`grille-online`, `resonance`), tous deux **en pause**. Aucun projet créé |
| Stripe | **non connecté** (reconnexion requise dans les connecteurs claude.ai) | aucun : aucune clé, aucun appel Stripe réel |
| GitHub | connecté (MCP) | push de la branche |
| Firecrawl | connecté | recherche web des deux sous-agents |
| Gmail | reconnexion requise | non utilisé |
| Airtable, Google Calendar, Metricool, Supermetrics, Windsor.ai, ElevenLabs, Kernel | connectés | non utilisés : pas utiles à ce stade |

## 5. Contraintes et dépendances manquantes

- **Médias en basse définition** (480 à 640 px) : suffisants en mobile, doux en plein écran desktop. Il faudra des exports 1080p pour le flux desktop.
- **Pas de photo de Sébastien** : l'en-tête du profil utilise une typographie forte et un extrait vidéo à la place d'un avatar.
- **Pas de liens réseaux sociaux** (Instagram, LinkedIn) dans le dépôt : aucun lien publié.
- **Statut juridique inconnu** (EI, micro-entreprise ?), SIRET, adresse, médiateur : bloquants pour les mentions légales et la vente aux particuliers.
- **Tarifs non définis** : toutes les prestations sont "sur devis".

## 6. Décisions qui nécessitent votre validation

Voir la section "Bloqué" du rapport final (`08-rapport-final.md`), qui les reprend avec leur impact.
