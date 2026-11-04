# Audit du dépôt avant la phase 6

Date : 2026-11-04 · Périmètre : `snap-clip-factory/` (commit `2531e58`) et son isolation du site « Avant la sortie ».

Convention : **CONFIRMÉ** = reproduit par exécution ou lu sans ambiguïté dans le code ;
**HYPOTHÈSE** = plausible mais non reproduit. Les sondes utilisées sont décrites en annexe.

## 1. Éléments vérifiés

| Domaine | Vérification | Résultat |
|---|---|---|
| Tests existants | `cloud/` : `pytest` | 20 réussis |
| | `desktop-agent/` : `pytest` (vraie vidéo H.264 via ffmpeg) | 6 réussis |
| Chaîne multi-processus | uvicorn + client scripté jouant l'iPhone + `scf-agent run` réel, 10 vidéos, une coupure par vidéo | 10/10 reçues, SHA-256 identiques, relais vide à la fin (session précédente) |
| États vidéo | transitions vérifiées côté serveur (`cloud/app/state.py`), transition illégale → 409 | testé |
| Authentification | appairage à usage unique, rotation des jetons, détection de réutilisation, révocation | testé (`tests/test_security.py`) |
| Contrôle d'accès | isolation entre comptes, séparation des rôles iPhone / agent / utilisateur | testé |
| Intégrité | morceau corrompu (422), fichier global faux (FAILED), `.part` corrompu côté agent | testé |
| Reprise | morceaux manquants → même session ; `.part` + `Range` ; redémarrage de l'agent | testé |
| WebSocket | jeton dans le premier message (pas dans l'URL), jeton d'appareil refusé | testé |
| Débit d'assemblage serveur | 1 Go assemblé + haché en 6,4 s ici (≈ 159 Mo/s) | mesuré, **dépend du disque** |

## 2. Éléments NON vérifiés

| Élément | Pourquoi |
|---|---|
| Compilation de l'app iOS | pas de Xcode dans cet environnement. Aucune ligne Swift n'a été compilée. |
| Comportement iOS réel (PhotoKit, accès limité, `URLSession` d'arrière-plan, BGTaskScheduler, extension de partage) | nécessite un iPhone |
| Partage depuis Snapchat vers l'extension | dépend de ce que Snapchat expose dans sa feuille de partage |
| Agent sur Windows et macOS (trousseau, LaunchAgent, tâche planifiée) | seul Linux est disponible ici |
| PostgreSQL | tous les tests utilisent SQLite ; `docker-compose.yml` n'a jamais été lancé |
| Exclusion Vercel | `.vercelignore` contient `snap-clip-factory/`. La documentation Vercel décrit ce fichier pour les déploiements ; je n'ai pas pu vérifier son effet sur un vrai déploiement Git du site. **À contrôler dans les fichiers du prochain déploiement.** |
| Vidéos 4K réelles de bout en bout | protocole conçu pour (morceaux, flux, hachage en continu) ; seul l'assemblage a été mesuré à 1 Go |

## 3. Problèmes identifiés

### Bloquants pour la phase 6

| # | Problème | Statut | Fichiers |
|---|---|---|---|
| B1 | **Une vidéo relancée depuis le dashboard n'est retraitée qu'au redémarrage de l'agent.** Sonde A : panne de traitement → `FAILED` → *Relancer* → reste `VERIFIED` après 2 cycles ; passe `COMPLETED` seulement après redémarrage. `reconcile()` n'est appelé qu'au démarrage. | CONFIRMÉ | `desktop-agent/scf_agent/agent.py:64`, `:155` |
| B2 | **Une coupure réseau pendant le traitement bloque la vidéo.** Sonde B : `ConnectError` sur le rapport `COMPLETED` → étape locale figée à `processing`, serveur à `PROCESSING`, jamais repris sans redémarrage. Le traitement n'attrape pas les erreurs HTTP. | CONFIRMÉ | `desktop-agent/scf_agent/agent.py:114-127` |

Ces deux défauts sont dans l'étape de **traitement** de l'agent, que la phase 6 étend (transcription, analyse) : sans correction, une analyse interrompue resterait bloquée. **Ils sont corrigés dans cette phase** (section 5), sans toucher au transfert.

### Importants (non bloquants pour la phase 6, à traiter avant un usage quotidien)

| # | Problème | Statut | Fichiers | Recommandation |
|---|---|---|---|---|
| I1 | **`/complete` concurrents sur une même session → erreurs 500.** Sonde C : 4 appels simultanés → 1 × 200, 3 × `FileNotFoundError` (500). L'état final reste correct (`VERIFIED`) et aucune corruption n'a été observée. | CONFIRMÉ | `cloud/app/routers/uploads.py:123-150` | verrou par session (statut `assembling`) qui renvoie 409 *en cours* |
| I2 | **Risque 4K : délai de `/complete`.** L'assemblage + SHA-256 est synchrone ; l'app iOS coupe une requête au bout de 60 s. À 159 Mo/s, 4 Go ≈ 26 s ; sur un disque de VPS à ~50 Mo/s, ≈ 80 s → expiration côté iPhone, nouvel essai, donc I1. | HYPOTHÈSE (débit du disque de production inconnu) | `uploads.py:135`, `ios/…/APIClient.swift:48` | hacher au fil des morceaux reçus dans l'ordre, ou rendre la vérification asynchrone (202 + interrogation) ; à défaut, délai de 300 s pour `/complete` |
| I3 | **Aucune limitation des essais de connexion.** Sonde D : 30 mauvais mots de passe d'affilée → toujours 401, jamais bloqué. | CONFIRMÉ | `cloud/app/routers/auth.py:43` | limite par IP et par compte (ex. 10/15 min), délai croissant |
| I4 | **Pas de nettoyage du relais.** Sessions d'upload expirées et copies jamais récupérées par un ordinateur restent sur le disque. | CONFIRMÉ (aucun code de purge) | `cloud/app/storage.py`, `routers/uploads.py` | tâche périodique : sessions expirées, relais > N jours |
| I5 | **Schéma créé au démarrage, sans migrations.** Ajouter une colonne à une table existante ne sera pas appliqué à une base déjà créée. | CONFIRMÉ | `cloud/app/main.py:21` | Alembic avant la production. *La phase 6 n'ajoute que des tables nouvelles pour ne pas dépendre de ce point.* |
| I6 | **Jeton utilisateur de 12 h non révocable.** La déconnexion efface seulement le jeton du navigateur. | CONFIRMÉ | `cloud/app/config.py:22`, `dashboard.html:127` | jetons courts + rafraîchissement, ou liste de révocation |

### Mineurs / dette technique

| # | Constat | Statut | Fichiers |
|---|---|---|---|
| M1 | Événement temps réel publié avant le `commit` : en cas d'échec du commit, le dashboard rafraîchit pour rien (pas de donnée fausse, il relit l'état). | CONFIRMÉ (lecture) | `cloud/app/deps.py:111` |
| M2 | Pas d'en-têtes `Content-Security-Policy` ni `Strict-Transport-Security`. Les données sont échappées dans le dashboard (pas de faille XSS trouvée), mais la CSP réduirait l'impact d'une erreur future. | CONFIRMÉ | `cloud/app/main.py` |
| M3 | `--forwarded-allow-ips "*"` : acceptable tant que le port 8000 n'est exposé qu'à Caddy (c'est le cas dans `docker-compose.yml`). À revoir si l'API est publiée autrement. | CONFIRMÉ (lecture) | `cloud/Dockerfile:10` |
| M4 | Inscription du premier compte : deux requêtes simultanées pourraient créer deux comptes. | HYPOTHÈSE (non reproduit) | `routers/auth.py` |
| M5 | `Content-Length` vérifié, mais un corps en *chunked encoding* est lu entièrement avant le contrôle de taille (appareil authentifié uniquement). | CONFIRMÉ (lecture) | `routers/uploads.py` |
| M6 | Le journal d'activité grandit sans limite. | CONFIRMÉ | `models.py` (`ActivityLog`) |
| M7 | iOS, au passage en arrière-plan : préparer jusqu'à 512 Mo de morceaux peut dépasser les ~30 s accordées par iOS ; les morceaux non préparés partiront au prochain réveil. | HYPOTHÈSE | `ios/…/SyncCoordinator.swift` |

Rien de critique n'a été trouvé côté confidentialité : aucune route publique, URL de téléchargement signées et liées à l'appareil, aucune clé ni vidéo exposée.

## 4. Recommandations par priorité

1. **P0 (cette phase)** : corriger B1 et B2 dans l'étape de traitement de l'agent.
2. **P1 (avant usage quotidien)** : I1 + I2 (verrou de session, `/complete` compatible 4K), I3 (limitation de connexion), compiler l'app iOS et valider la phase 3 sur l'iPhone.
3. **P2** : I4 (nettoyage du relais), I5 (Alembic), I6 (jetons utilisateur), essai réel sur PostgreSQL, contrôle du déploiement Vercel.
4. **P3** : M1 à M7.

I1 et I2 touchent le mécanisme d'upload : conformément à la consigne, **je ne les modifie pas dans cette phase**. Ils demandent ton accord.

## 5. Plan de la phase 6 (annoncé avant le code)

Principe : **ajouts uniquement**. Aucun fichier de synchronisation (uploads, appairage, relais, app iOS) n'est modifié ; les nouvelles données vivent dans des tables nouvelles.

| Étape | Où | Contenu |
|---|---|---|
| 0 | agent | correction B1 (réconciliation à chaque cycle) et B2 (erreurs réseau du traitement → nouvel essai différé) |
| 1 | `cloud/app/ai/` | interface fournisseur commune, adaptateurs Anthropic, OpenAI, compatible OpenAI (Ollama, vLLM, LM Studio…), et un mode **DÉMO** sans IA dont les résultats sont marqués *simulés* |
| 2 | cloud | configuration IA centralisée par compte (fournisseur, modèle, langue, niveau, limites de coût et de taille) ; clés uniquement en variables d'environnement serveur |
| 3 | cloud | tables `clips`, `analysis_inputs`, `analysis_jobs`, `ai_configs` ; machine d'états des clips ; garde de publication |
| 4 | agent | extraction audio, transcription locale horodatée (faster-whisper, optionnel), détection de plans, silences et niveau sonore ; sauvegarde locale ; envoi **texte seulement** |
| 5 | cloud | moteur de détection des moments : découpage des longues transcriptions, validation stricte des propositions (timecodes, catégories, citations vérifiées dans la transcription) |
| 6 | cloud | page **Studio** (mobile) : vidéos, transcriptions, clips, filtres, validation, édition des timecodes, coûts, réglages IA |
| 7 | tests | vidéos synthétiques (dialogue à 2 voix, silence, musique, bruit), adaptateurs testés sans clé, garde de publication, reprises |

## 6. État après la phase 6

| # | Statut |
|---|---|
| B1 | **corrigé** (`agent.py`, réconciliation à chaque cycle) — test `test_dashboard_retry_reprocessed_without_restart` |
| B2 | **corrigé** (`agent.py`, erreur réseau → nouvel essai différé) — test `test_network_cut_during_analysis_upload_is_retried` |
| I1 à I6, M1 à M7 | **inchangés**, en attente de ta décision (I1 et I2 touchent l'upload) |

## Annexe — sondes d'audit

Script exécuté (hors dépôt) réutilisant le banc d'essai `desktop-agent/tests/test_agent_e2e.py` :

- **A** : panne forcée de `run_pipeline` → relance dashboard → 2 cycles d'agent → redémarrage. Résultat : `FAILED` → `VERIFIED` → `VERIFIED` → `COMPLETED`.
- **B** : `httpx.ConnectError` injecté sur le rapport `COMPLETED`, puis 2 cycles. Résultat : étape locale `processing`, serveur `PROCESSING`.
- **C** : 4 threads appellent `/complete` sur une session de 3 Mo complète. Résultat : codes `[200]` + 3 exceptions `FileNotFoundError`, état final `VERIFIED`.
- **D** : 30 connexions avec un mauvais mot de passe. Résultat : 30 × 401, aucun blocage.
- **Débit** : 128 morceaux de 8 Mo assemblés par `LocalRelayStorage.assemble` : 6,4 s.
