# 07 · Plan de marquage et KPI

Source de vérité du code : `src/lib/analytics/events.ts`. Tout événement absent de cette liste, ou dont les paramètres ne passent pas la validation, est **rejeté** par `/api/events`.

## 1. Règles de collecte

| Règle | Implémentation |
|---|---|
| Rien avant le consentement | `track()` n'envoie ni ne met en file quoi que ce soit si "Mesure d'audience" n'est pas acceptée ; l'API revérifie le cookie de consentement **côté serveur** |
| Retrait aussi simple que l'accord | lien "Cookies" dans le pied de page de chaque page ; au refus, `sfp_sid` et `sfp_vid` sont effacés |
| Robots | UA déclarés (Googlebot, outils, headless, curl…) rejetés à l'ingestion ; `navigator.webdriver` ignoré côté client |
| Tests internes | admin connecté, ou visite avec `?internal=1` (mémorisé ; `?internal=0` pour annuler) : événements stockés avec `internal = true` et **exclus de tous les KPI** |
| Doublons | chaque événement porte un UUID ; `ON CONFLICT DO NOTHING` ; `video_start` dédoublonné par vidéo et par page |
| Faux clics et conversions | les conversions (devis, paiement) sont des **événements serveur**, écrits seulement après validation ou webhook signé : impossible à simuler depuis le navigateur |
| Minimisation | pas d'IP stockée ; référent réduit au nom de domaine ; liens externes réduits au domaine ; pays (code ISO) seulement s'il est fourni par l'hébergeur ; aucune donnée de formulaire dans les événements |
| Conservation | identifiant visiteur 13 mois non prolongé ; événements et preuves de consentement purgés à 25 mois (`/api/cron/purge`) |

## 2. Dictionnaire des événements client (consentement requis)

| Événement | Déclencheur | Paramètres | Objectif |
|---|---|---|---|
| `page_view` | changement de page (pas sur `/admin`) | `path`, `referrer` (réduit au domaine) | trafic, pages vues, sources |
| `video_start` | première lecture d'une vidéo sur la page | `project`, `video`, `surface` (feed, project, home) | lectures vidéo |
| `video_progress` | passages à 25, 50 et 75 % | `project`, `video`, `pct` | rétention |
| `video_complete` | fin de lecture (vidéos non bouclées) | `project`, `video` | complétion |
| `feed_swipe` | changement d'élément dans le flux | `from`, `to`, `index` | profondeur de visionnage |
| `artist_bubble_click` | clic sur une bulle | `artist`, `surface` (home, constellation, feed, project) | intérêt par artiste |
| `project_open` | ouverture d'un projet | `project`, `surface` | projets les plus consultés |
| `photo_open` | ouverture dans la visionneuse | `photo` | photos les plus vues |
| `cta_click` | clic sur devis, e-mail, téléphone, prestation | `cta`, `surface` | intention de contact |
| `outbound_click` | lien externe (réservé aux futurs liens d'artistes et réseaux sociaux) | `url` (domaine), `label` | sorties vers les réseaux |
| `share` | bouton Partager du flux | `project`, `method` (native, copy) | viralité |
| `quote_step` | affichage d'une étape du devis | `step` | entonnoir du formulaire |
| `web_vital` | mesures réelles LCP, CLS, INP, FCP, TTFB | `name`, `value`, `rating` | performance réelle |
| `js_error` | erreur JavaScript non interceptée | `message`, `source` | qualité technique |

## 3. Événements serveur (exhaustifs, sans traceur)

| Événement | Écrit par | Paramètres |
|---|---|---|
| `quote_submitted` | `/api/quote` après validation | `ref`, `service`, `budget`, `role`, `clientType`, `projectRef` |
| `checkout_started` | création de la session Checkout | `order`, `kind`, `amount_cents` |
| `payment_succeeded` | webhook signé | `payment`, `kind`, `amount_cents`, `livemode` |
| `payment_failed` | webhook signé | `payment`, `kind` |
| `payment_refunded` | webhook signé | `payment`, `refunded_cents` |
| `payment_anomaly` | webhook ou création de session | `reason` (montant différent, surpaiement, paiement sur commande annulée), détails ; déclenche aussi une notification e-mail si configurée |

Ces événements ne portent aucun identifiant de navigateur : ce sont des faits de gestion, pas des traceurs.

## 4. KPI du tableau de bord (`/admin`)

| KPI | Calcul | Couverture |
|---|---|---|
| Visiteurs, sessions, pages vues | `vid`, `sid` distincts, `page_view` | visiteurs consentants uniquement |
| Pages et projets les plus vus | `page_view` par chemin, `project_open` | consentants |
| Lectures, vues à 50 %, complétion | `video_*` par projet | consentants |
| Interactions avec les bulles | `artist_bubble_click` par artiste | consentants |
| Clics contact et devis | `cta_click` par CTA et surface | consentants |
| Liens externes | `outbound_click` | consentants (aucun lien externe publié pour l'instant) |
| Demandes de devis | table `quotes` | **exhaustif** |
| Paiements commencés et réussis | événements serveur | **exhaustif** ; test et live séparés |
| Chiffre d'affaires encaissé | somme des paiements réussis moins remboursements | **exhaustif** ; le mode test est affiché à part, avec la mention "non réel" |
| Taux devis / session | devis ÷ sessions consenties | **majoré** : le dénominateur n'inclut pas les refus |
| Taux d'acceptation de la mesure | dernier choix par identifiant de consentement | toutes les personnes ayant fait un choix |
| Sources de trafic | `utm_source`, sinon domaine référent, sinon "(direct)" | consentants |
| Performance réelle | p75 des Web Vitals | consentants |
| Erreurs JS | `js_error` par message | consentants |

## 5. Limites des mesures (à connaître pour lire les chiffres)

- Tout ce qui dépend du consentement est un **échantillon** : si 40 % acceptent, les visiteurs réels sont environ 2,5 fois plus nombreux. Le taux d'acceptation est affiché pour corriger mentalement.
- "Visiteurs" compte des navigateurs, pas des personnes (un même client sur mobile et ordinateur compte deux fois ; les navigations privées comptent à chaque fois).
- Les extraits vidéo tournent en boucle : "complétée" n'a de sens que pour les vidéos qui ne bouclent pas ; la vue à 50 % est l'indicateur fiable.
- Les robots non déclarés (UA de navigateur réel) peuvent passer ; le consentement obligatoire en filtre déjà l'essentiel, puisqu'un robot clique rarement sur "Accepter".
- **Mode exempté non activé** : la CNIL permet, sous conditions strictes, une mesure d'audience sans consentement (statistiques anonymes, pas d'UTM, IP tronquée, référent limité au domaine, au plus trois types d'événements). Notre plan (UTM, progression vidéo, entonnoir) dépasse ce cadre. Nous avons donc choisi le consentement pour tout. Activer un mode exempté minimal (pages vues et clics, sans identifiant) est possible ensuite, **après avis juridique**.
