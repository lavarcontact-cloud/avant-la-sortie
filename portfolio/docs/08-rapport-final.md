# 08 · Rapport final (passe 1)

Branche : `claude/portfolio-v1` · application : `portfolio/` · le site "Avant la sortie" (racine) n'a pas été modifié.

## 1. Fonctionnel et testé

| Fonctionnalité | Fichiers principaux | Tests | Résultat |
|---|---|---|---|
| Profil (accueil) : en-tête, CTA, bulles "stories", grille filtrable, La Var, prestations | `src/app/page.tsx`, `components/project-grid.tsx`, `bubbles.tsx` | E2E, axe, Lighthouse | OK |
| Flux vertical : lecture de l'élément visible, préchargement du suivant, clavier, URL partageable, timecode réel, "Fin de bobine", mouvement réduit | `src/app/flux/*` | E2E (lecture effective vérifiée par `currentTime`, navigation clavier, lien partagé), axe | OK |
| Constellation d'artistes (spirale desktop, nid d'abeille mobile, filtres, vue liste) | `src/app/artistes/*` | E2E (en mouvement réduit), axe | OK |
| Pages artiste et projet, transitions d'éléments partagés, données structurées JSON-LD | `src/app/artistes/[slug]`, `src/app/projets/[slug]` | E2E, axe, Lighthouse | OK |
| Galerie photo et visionneuse (`<dialog>`, flèches, Échap, swipe) | `components/gallery.tsx`, `src/app/photo` | E2E | OK |
| Vidéo : MP4 faststart et WebM VP9 de secours, affiches générées depuis les rushes | `public/media`, `scripts/posters.sh`, `components/video-sources.tsx` | test de présence des fichiers, E2E (lecture) | OK |
| Demande de devis en 3 étapes, validation client et serveur, anti-spam, référence | `src/app/devis/*`, `src/app/api/quote`, `lib/quote.ts` | unitaires + E2E (écriture en base vérifiée) | OK |
| Consentement : accord, refus, personnalisation, retrait, preuve serveur, redemande à 6 mois ou au changement de version | `components/consent.tsx`, `lib/consent.ts`, `api/consent` | unitaires + E2E (0 requête au refus, identifiants effacés au retrait) | OK |
| Mesure d'audience first-party (validation, robots, interne, doublons, sans IP) | `lib/analytics/*`, `api/events` | unitaires + E2E (lignes en base) | OK |
| Admin : connexion (scrypt, HMAC, quota), demandes, création de commande et de lien de paiement, commandes, contenus à vérifier, KPI | `src/app/admin/*`, `lib/admin-auth.ts`, `lib/analytics/kpi.ts` | unitaires + E2E (session falsifiée refusée) | OK |
| Logique de paiement : échéancier acompte/solde, webhook idempotent, contrôle du montant, SEPA différé, expiration, remboursements, une seule session payable à la fois, statuts qui ne reculent pas, anomalies signalées | `lib/payments.ts`, `api/stripe/webhook` | 10 tests d'intégration sur PostgreSQL réel + E2E signature HTTP | OK |
| Sécurité : CSP, HSTS, contrôle d'origine, limitation de débit, `noindex` de préproduction | `next.config.ts`, `lib/server-utils.ts` | E2E en-têtes + unitaires | OK |
| Mode développement sans base installée (PGlite) | `lib/db` | test dédié | OK |

**Résultats des tests (10/10/2026, exécutés dans cet environnement)**
- `tsc --noEmit` : 0 erreur.
- Vitest : **30/30** (contenu, sécurité, paiements et intégrité sur PostgreSQL 16, PGlite).
- Playwright : **44/44** (22 scénarios × mobile Pixel 7 + desktop 1440 px).
- axe-core WCAG 2.1 AA : **0 violation grave ou critique** sur 7 pages, sur les deux formats.
- Lighthouse 13.5 (mobile simulé, build de production local) :

| Page | Perf. | Access. | Bonnes prat. | SEO* | LCP | CLS |
|---|---|---|---|---|---|---|
| `/` | 86 | 100 | 96 | 69 | 4,0 s | 0 |
| `/flux` | 90 | 100 | 100 | 69 | 3,3 s | 0 |
| `/projets/brk-developpement` | 93 | 100 | 100 | 69 | 3,3 s | 0 |
| `/artistes` | 96 | 100 | 100 | 69 | 2,5 s | 0 |
| `/artistes/leto` | 91 | 100 | 96 | 69 | 3,4 s | 0 |
| `/devis` | 94 | 100 | 96 | 66 | 3,0 s | 0 |

\* Le SEO est plafonné **volontairement** par le `noindex` de préproduction : le site ne doit pas être indexé avant la validation des contenus et des droits. Mettre `SITE_INDEXABLE=true` lève ce plafond. Ces scores sont mesurés en local avec réseau simulé ; ils seront à refaire sur l'URL de production.

**Défauts trouvés et corrigés pendant les tests** (preuve que les tests ont servi) : propriétés JSON doublement encodées en base (aurait cassé tout le tableau de bord) ; message d'erreur Zod en anglais sur un champ vide du devis ; écran de fin du flux hors du rôle ARIA `feed` ; tableaux défilants non atteignables au clavier ; bandeau cookies illisible (verre trop transparent) puis superposé à l'admin ; chevauchement des bulles sur mobile ; erreur d'hydratation de la constellation ; LCP différé par `loading="lazy"` sur la première vignette ; une date de mise en ligne fabriquée dans le JSON-LD, une promesse "réponse sous 48 h" et une affirmation "publiées avec leur accord" (supprimées).

## 2. Développé, nécessite une validation

| Élément | Ce qui manque |
|---|---|
| **Paiement Stripe réel (mode test)** | la création de session Checkout n'a pas pu être exécutée contre Stripe : aucune clé de test (connecteur Stripe à reconnecter, ou clés `sk_test_` à fournir). La logique et la vérification de signature sont testées ; le parcours "carte de test 4242" reste à faire |
| Remboursement depuis l'admin | même raison (appel API Stripe non exécuté) |
| Pages légales | brouillons structurés avec les champs manquants **surlignés** ; rédaction et validation par un avocat |
| Contenus | 13 projets sur 14 ont une autorisation de diffusion "à confirmer", 3 ont des faits "à vérifier", et 11 fiches artistes sont "à vérifier" (liste dans `/admin/contenus`) |
| E-mails | notification à Sébastien via Resend si configurée ; **accusé de réception de rétractation par e-mail au client non branché** (aujourd'hui : affiché à l'écran avec référence et date) ; e-mail de confirmation de commande non branché |
| Performance de l'accueil | LCP de 4,0 s en 4G simulée ; pistes : réduire le JavaScript client (consentement et télémétrie chargés à la demande), servir les vidéos depuis un CDN |

## 3. Non développé ou dépendant d'une ressource externe

- **CMS visuel** (Keystatic, recommandé) : aujourd'hui, l'ajout de contenu se fait dans `content/*.json`.
- **Vidéo HD et streaming adaptatif** : les sources fournies font 480 à 640 px ; il faut des exports 1080p et un CDN vidéo (Mux, Cloudflare Stream, Bunny) pour le plein écran desktop.
- **Liens réseaux sociaux et liens par artiste** : aucune URL fournie (le suivi `outbound_click` est prêt).
- **Photo de Sébastien**, page "presse / kit média", version anglaise.
- **Offres à prix fixe et réservation de créneaux** : aucun tarif défini.
- Facturation (numérotation légale, facture électronique au 01/09/2027) : à confier à un outil de facturation ou à l'expert-comptable.

## 4. Bloqué par une information ou une décision de votre part

| # | Décision | Impact |
|---|---|---|
| 1 | **Guy2Bezbar** : quelle collaboration, avec quelle source ? | absent du site tant que ce n'est pas documenté |
| 2 | **Paternité des 9 portraits** (Gazo, Koba LaD, Landy, Bianca Costa, Jolagreen, MIG, Duo Bahysa, Leto presse, concert) et artiste de la photo de concert (Nono La Grinta ou Ashe22 ?) | affichés sans rôle revendiqué ; à confirmer ou retirer |
| 3 | **Autorisations de diffusion** (artistes, labels, musique des extraits) | nous recommandons de ne pas indexer le site avant |
| 4 | **Statut juridique, SIRET, adresse, régime de TVA, médiateur de la consommation** | mentions légales et vente aux particuliers bloquées |
| 5 | **Vendre aussi aux particuliers ?** | si non (B2B uniquement), le parcours se simplifie : pas de rétractation ni de médiateur |
| 6 | **Tarifs ou fourchettes publiques, pourcentage d'acompte** (30 % par défaut, modifiable par commande) | prestations affichées "sur devis" |
| 7 | **Hébergement de production** : nouveau projet Vercel (Root Directory `portfolio`) + base PostgreSQL UE (Supabase Paris ou Neon). Vos 2 projets Supabase existants sont en pause ; en créer un troisième peut être payant selon votre offre | rien n'a été créé ni engagé |
| 8 | **Stripe** : reconnecter le connecteur ou fournir des clés **de test** | test du paiement réel |
| 9 | **Nom de domaine** | URL canonique, e-mails |
| 10 | Publier le **téléphone** sur le site ? (il l'est sur "Avant la sortie") | affiché par défaut ; retirable dans `content/site.json` |

## 5. Lancer le projet

```bash
cd portfolio
npm install
cp .env.example .env.local
npm run admin:hash -- "un mot de passe d'au moins 12 caractères"   # coller les 2 lignes dans .env.local
npm run dev                                                          # http://localhost:3000
```

Tests : `TEST_DATABASE_URL=postgres://… npm test`, puis `npm run dev -- -p 3100` et `npm run test:e2e`.

## 6. Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | oui (prod) | URL publique |
| `DATABASE_URL` | oui (prod) | PostgreSQL UE |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | oui | accès admin |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | pour payer | clés **de test** jusqu'à validation |
| `STRIPE_LIVE_APPROVED` | non | `true` seulement après votre accord explicite pour le live |
| `CRON_SECRET` | oui (prod) | purge quotidienne |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM` | non | notifications e-mail |
| `IP_HASH_SALT` | non | sel anti-abus |
| `SITE_INDEXABLE` | non | `true` pour autoriser l'indexation |

## 7. Déploiement (à faire après accord)

1. Vercel : **nouveau** projet sur ce dépôt, Root Directory `portfolio`, région `cdg1` (le projet `avant-la-sortie` reste inchangé).
2. Base PostgreSQL en UE, puis `DATABASE_URL=… npm run db:migrate`.
3. Saisir les variables ci-dessus.
4. Stripe (test) : webhook `https://<domaine>/api/stripe/webhook` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
5. Recette : devis, commande, paiement avec carte de test, remboursement, KPI, consentement.
6. Validation juridique et des droits, puis `SITE_INDEXABLE=true`, puis clés live avec `STRIPE_LIVE_APPROVED=true`.

## 8. Sources officielles

Voir `06-conformite-juridique.md` §15 (CNIL, Légifrance, EUR-Lex, Service-Public, DGCCRF, impots.gouv.fr, Stripe, PayPal), consultées le 09/10/2026, et `02-recherche-references.md` pour les références design.

## 9. Équipe : qui a fait quoi

| Rôle du brief | Réalisé par |
|---|---|
| Directeur artistique, recherche de références | sous-agent dédié (16 références chargées) + session principale |
| Conformité, analytics, paiement (recherche) | sous-agent dédié (sources officielles) |
| QA et testeur indépendant | sous-agent relecteur distinct, n'ayant pas écrit le code (§10) + tests automatisés |
| PM, UX, front, back, motion, vidéo, SEO, responsable technique | session principale, par passes successives |

## 10. Revue indépendante (QA / sécurité) et corrections

Un relecteur distinct, qui n'avait pas écrit le code, a audité l'application sans la modifier. Il n'a trouvé **aucun contournement de l'admin, aucune injection SQL, aucune XSS ni redirection ouverte**. Il a relevé 10 défauts, tous corrigés et testés dans cette passe :

| Sévérité | Défaut | Correction |
|---|---|---|
| Élevée | deux sessions Checkout payables pour la même échéance (double clic, deux onglets) | les sessions ouvertes sont expirées chez Stripe avant d'en créer une ; index unique "une échéance ouverte par commande" ; 10 tentatives par heure et par commande ; alerte en cas de surpaiement |
| Élevée | commande annulée encore payable, et paiement alors invisible | l'annulation expire d'abord les sessions ; un paiement reçu sur une commande annulée lève une anomalie (événement et e-mail) |
| Moyenne | statut de paiement qui régresse selon l'ordre des webhooks | transitions vers l'avant uniquement (sauf "en cours" vers "échoué") |
| Moyenne | `page_view` compté deux fois lors de l'acceptation | doublon supprimé |
| Moyenne | jeton de paiement enregistré dans les statistiques | chemin remplacé par `/paiement/[jeton]`, côté client et côté serveur (vérifié en base) |
| Faible | remboursements cumulatifs reçus à l'envers | on garde le plus grand montant |
| Faible | écart de montant ignoré en silence | anomalie enregistrée et notifiée |
| Faible | bandeau "13 mois" contre une purge à 25 mois | texte aligné : identifiant 13 mois, statistiques 25 mois |
| Faible | chiffre d'affaires daté par `updated_at` ; entonnoir mêlant test et réel | colonne `paid_at` ; libellé "(test + réel)" |
| Faible | consentement daté dans le futur, clé d'idempotence de remboursement figée 24 h | date future rejetée ; clé renouvelée toutes les 10 min |

**Non corrigé, documenté** : la limitation de débit du login repose sur `x-forwarded-for`, fiable derrière Vercel mais pas en auto-hébergement sans proxy de confiance. Le paramètre `?erreur=` de l'admin affiche un texte libre (échappé, donc sans risque d'injection). L'action n'est accessible qu'une fois connecté.

## 11. Aperçu déployé (Vercel)

| Élément | Valeur |
|---|---|
| URL | https://sfp-portfolio-zeta.vercel.app |
| Accès | protégé par la connexion Vercel du compte `lavarcontact-cloud` sur **toutes** les URL, y compris les médias (vérifié depuis Internet : un visiteur anonyme voit "Log in to Vercel") |
| Projet Vercel | `sfp-portfolio` (prj_qbWUxfESlswZZYvzyB9hAsXDvDca), séparé d'`avant-la-sortie` |
| Source | dépôt `lavarcontact-cloud/avant-la-sortie`, branche `claude/portfolio-v1`, répertoire racine `portfolio`, Next.js, région `cdg1` |
| Variables d'environnement | aucune : pas de base de données, pas de secret, pas de Stripe |
| Coût | offre Hobby (gratuite), aucune option payante |

**Comportement sans base de données** (vérifié par `e2e/apercu.spec.ts` sur un build de production sans aucune variable, 13 tests réussis) :
- devis : un message indique que le formulaire n'est pas activé et renvoie vers l'e-mail ; aucun faux succès, et la saisie est conservée ;
- espace privé : la connexion répond "pas activé sur cette version d'aperçu" ; toutes les pages `/admin/*` redirigent vers la connexion, même avec un cookie falsifié ;
- paiement : `/paiement/*` renvoie 404, le webhook Stripe renvoie 503 ;
- rétractation : message et e-mail à la place du formulaire ;
- consentement : le choix est mémorisé dans le navigateur, mais aucune preuve n'est journalisée et aucune statistique n'est stockée.

**Ce qui n'a pas pu être testé sur l'URL déployée elle-même** : le réseau de l'environnement de travail bloque `*.vercel.app`, et les outils Vercel de contournement temporaire de la protection, comme la lecture des journaux de build, renvoient 403 avec ce connecteur. Le contenu a été testé sur un build de production du même commit, depuis un clone vierge ; l'URL déployée a été contrôlée de l'extérieur (en ligne et protégée).

**Isolation** : aucun réglage d'`avant-la-sortie` n'a été modifié (date de dernière modification des réglages, domaines et protection identiques avant et après). Comme ce projet est relié au dépôt, Vercel y crée automatiquement des déploiements d'**aperçu** de la branche `claude/portfolio-v1`. Ils n'ont aucun effet sur sa production ni sur ses domaines, et restent derrière la connexion Vercel. Pour les éviter, il faudrait modifier un réglage d'`avant-la-sortie` ("Ignored Build Step"), ce qui n'a pas été fait sans votre accord.
