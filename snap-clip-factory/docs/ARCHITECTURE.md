# SNAP CLIP FACTORY — Architecture V3 (iPhone + PC/Mac + Cloud)

## 1. Vue d'ensemble

```
┌──────────────────────┐   HTTPS, morceaux    ┌──────────────────────────┐   HTTPS, URL signée   ┌───────────────────────┐
│  SNAP CLIP MOBILE    │ ───────────────────▶ │  CLOUD CONTROL PLANE      │ ◀──────────────────── │  DESKTOP AGENT         │
│  iOS, Swift/SwiftUI  │   + SHA-256          │  FastAPI + PostgreSQL     │   (Range, reprise)    │  Python, SQLite,       │
│  PhotoKit, partage   │ ◀─── commandes ───── │  relais temporaire        │ ──── commandes ─────▶ │  FFmpeg                │
└──────────────────────┘                      │  WebSocket dashboard      │                       │  bibliothèque locale   │
                                              └────────────┬─────────────┘                       └───────────────────────┘
                                                           │ WebSocket
                                                    ┌──────▼──────┐
                                                    │  DASHBOARD  │
                                                    └─────────────┘
```

Principe directeur : **le Cloud orchestre, il ne stocke pas.** Il sert de relais
le temps qu'une vidéo passe de l'iPhone à l'ordinateur, puis supprime sa copie
dès que l'agent confirme l'avoir reçue avec la même empreinte. Les originaux
vivent sur l'iPhone (jamais supprimés) et sur l'ordinateur.

Pourquoi un relais plutôt qu'un transfert direct iPhone → ordinateur : l'iPhone
et l'ordinateur ne sont presque jamais joignables l'un par l'autre (NAT, veille,
réseaux différents), et il ne faut jamais exposer un dossier local sur Internet.
Les deux appareils n'ouvrent que des connexions **sortantes** vers le Cloud.

## 2. Protocole de synchronisation

### Fiche vidéo

| Champ | Source |
|---|---|
| `id` | identifiant interne (serveur) |
| `asset_local_id` | `localIdentifier` PhotoKit, ou `share:<uuid>` pour un import par partage |
| `filename`, `source_created_at`, `duration_s`, `width`, `height` | PhotoKit / AVFoundation |
| `size_bytes`, `sha256` | calculés sur le fichier exporté |
| `origin` | `photos` · `share` · `snapchat_memories` |
| `state` | machine d'états ci-dessous |

### États

```
DISCOVERED ─▶ QUEUED ─▶ UPLOADING ─▶ UPLOADED ─▶ VERIFIED ─▶ PROCESSING ─▶ COMPLETED
                 ▲          │  ▲                     ▲           │
                 └──────────┘  └──────── FAILED ─────┴───────────┘   (reprise)
```

- `DISCOVERED` : inventoriée (métadonnées seulement, pas encore exportée).
- `QUEUED` : empreinte SHA-256 connue, en file d'envoi.
- `UPLOADING` : session d'upload ouverte.
- `UPLOADED` → `VERIFIED` : le serveur a réassemblé le fichier et recalculé le
  SHA-256, identique à celui annoncé. Sinon `FAILED` (copie relais détruite).
- `PROCESSING` / `COMPLETED` : rapportés par l'agent desktop.

Les transitions sont vérifiées côté serveur (`cloud/app/state.py`) ; toute
transition interdite renvoie 409.

### Séquence

1. **Inventaire** — `POST /v1/videos/batch` : upsert idempotent par (appareil, `asset_local_id`).
2. **Empreinte** — l'iPhone exporte la vidéo via `PHAssetResourceManager`
   (téléchargement iCloud autorisé), calcule le SHA-256 en flux, puis
   `POST /v1/videos/{id}/fingerprint`. **Déduplication** : si une vidéo du même
   compte a déjà cette empreinte (même vidéo dans Photos et exportée de Snapchat,
   par exemple), la fiche est fusionnée dans l'existante.
3. **Session** — `POST /v1/videos/{id}/uploads` → `upload_id`, `chunk_size`
   (8 Mo par défaut), `total_chunks`, `received[]`. Rappeler cette route renvoie
   **la même session** et la liste des morceaux déjà reçus : c'est la reprise.
4. **Morceaux** — `PUT /v1/uploads/{uid}/chunks/{n}` avec `X-Chunk-SHA256`.
   Écriture atomique, idempotente : un renvoi ne casse rien.
5. **Clôture** — `POST /v1/uploads/{uid}/complete` : 409 + `missing[]` s'il
   manque des morceaux ; sinon assemblage, SHA-256 global, `VERIFIED`.
6. **Rapatriement** — l'agent lit `GET /v1/agent/inbox` (les plus récentes
   d'abord), télécharge par URL signée HMAC (10 min, liée à l'appareil, `Range`
   pour reprendre), re-hache localement, puis `POST /v1/videos/{id}/delivered`.
   **Le relais est alors purgé.**
7. **Traitement** — l'agent passe la vidéo en `PROCESSING`, exécute le pipeline
   local, puis `COMPLETED` (ou `FAILED` avec l'erreur).

### Exigences et où elles sont traitées

| Exigence | Mise en œuvre |
|---|---|
| Upload par morceaux | sessions + morceaux de 256 Ko à 32 Mo |
| Reprise après interruption | `received[]` côté serveur ; `.part` + `Range` côté agent ; file persistante des deux côtés |
| Vérification d'intégrité | SHA-256 par morceau, global au serveur, puis à nouveau sur l'ordinateur |
| Gestion des erreurs | backoff exponentiel (30 s → 1 h), 5 essais automatiques puis relance manuelle |
| Limitation de bande passante | iOS : Wi-Fi par défaut, jamais en mode Données réduites, 3 morceaux simultanés max. Agent : `max_download_bytes_per_s` |
| Doublons | unicité (compte, SHA-256) côté serveur ; index SHA local côté agent |
| Priorité aux récentes | tri par date de création décroissante, partout |
| Pause / reprise | bouton iPhone, boutons dashboard (commande `pause`/`resume`), état persistant |
| Ne jamais supprimer l'original | aucune API d'écriture PhotoKit n'est appelée ; seules les copies temporaires de l'app sont effacées |

## 3. Application iPhone — SNAP CLIP MOBILE

`ios/` — Swift 5.10, SwiftUI, iOS 17+, projet généré par XcodeGen.

- **Autorisations** : `PHPhotoLibrary.requestAuthorization(for: .readWrite)`.
  Accès limité géré (bandeau + `presentLimitedLibraryPicker`). Accès refusé :
  lien vers Réglages. Aucun contournement.
- **Découverte** : `PHAsset.fetchAssets(with: .video)` + `PHPhotoLibraryChangeObserver`
  pour les nouvelles vidéos tant que l'app tourne.
- **Envoi** : `URLSession` **d'arrière-plan** (`UploadEngine`). iOS poursuit les
  envois confiés même app suspendue, et relance l'app à la fin
  (`handleEventsForBackgroundURLSession`). Au passage en arrière-plan, l'app
  confie d'un coup jusqu'à 512 Mo de morceaux.
- **Tâches de fond** : `BGAppRefreshTask` (inventaire, commandes) et
  `BGProcessingTask` (export, empreinte, envoi). **Opportunistes** : iOS décide
  quand et si elles tournent. Aucune synchronisation permanente n'est promise ;
  le bouton **SYNCHRONISER MAINTENANT** est la voie fiable.
- **Commandes du dashboard** : récupérées à l'ouverture, toutes les 30 s
  app ouverte, et lors des réveils iOS. Réveiller l'app à distance demanderait
  des notifications push silencieuses (APNs), elles aussi non garanties : prévu
  plus tard.
- **Snapchat** : extension de partage. Depuis Snapchat (Souvenirs → Exporter,
  quand Snapchat propose la feuille de partage iOS) ou depuis Fichiers, l'utilisateur
  choisit *Snap Clip*. L'extension copie le fichier dans l'App Group ; l'app le
  synchronise et ne supprime cette copie qu'une fois la vidéo arrivée sur
  l'ordinateur. Pas de scraping, pas de cookies, pas d'API privée.
- **Sécurité** : jeton de rafraîchissement dans le trousseau
  (`AfterFirstUnlockThisDeviceOnly`), jeton d'accès en mémoire, état de la file
  chiffré par la protection de données iOS.

## 4. Agent desktop

`desktop-agent/` — Python 3.11+, `httpx`, SQLite, FFmpeg. Windows, macOS (et Linux).

- `scf-agent audit` : **phase 1** (OS, CPU, RAM, GPU, FFmpeg, disque, recommandation transcription).
- `scf-agent pair --server … --code …` : appairage (HTTPS obligatoire hors localhost).
- `scf-agent run` : boucle autonome, indépendante du dashboard. Interroge le Cloud
  (*polling* sécurisé, 15 s), télécharge, vérifie, range dans
  `<bibliothèque>/AAAA/MM/AAAAMMJJ_HHMMSS_<sha8>_<nom>`, traite.
- Reprise après redémarrage : file SQLite locale + `GET /v1/agent/assigned`.
- Protège le disque : s'arrête sous `min_free_disk_bytes` (5 Go par défaut).
- `scf-agent autostart enable` : LaunchAgent (macOS), tâche planifiée à
  l'ouverture de session (Windows), service systemd utilisateur (Linux).
- Secrets : trousseau du système via `keyring` (Keychain, Gestionnaire
  d'identification Windows), sinon fichier `0600`.
- Pipeline local actuel : `ffprobe` (codec, résolution, rotation, fps, audio) +
  vignette. Les phases 6–7 s'y branchent comme étapes supplémentaires.

## 5. Cloud Control Plane

`cloud/` — FastAPI, SQLAlchemy 2, PostgreSQL (SQLite en dev/tests), stockage relais.

| Domaine | Routes |
|---|---|
| Compte | `POST /v1/auth/register` (premier compte seulement), `POST /v1/auth/login` |
| Appareils | `POST /v1/pairing-codes`, `POST /v1/devices/pair`, `POST /v1/auth/refresh`, `GET /v1/devices`, `DELETE /v1/devices/{id}`, `POST /v1/devices/me/heartbeat`, `GET /v1/devices/me/commands` |
| Vidéos | `POST /v1/videos/batch`, `POST /v1/videos/{id}/fingerprint`, `GET /v1/videos`, `POST /v1/videos/{id}/retry` |
| Upload | `POST /v1/videos/{id}/uploads`, `GET|DELETE /v1/uploads/{uid}`, `PUT /v1/uploads/{uid}/chunks/{n}`, `POST /v1/uploads/{uid}/complete` |
| Agent | `GET /v1/agent/inbox`, `GET /v1/blobs/{id}` (signée), `POST /v1/videos/{id}/delivered`, `POST /v1/videos/{id}/state`, `GET /v1/agent/assigned` |
| Dashboard | `GET /`, `GET /v1/dashboard/summary`, `GET /v1/activity`, `POST /v1/sync/{sync_now|pause|resume}`, `WS /v1/ws` |

Choix assumés pour le MVP, à faire évoluer :
- **Stockage relais** sur disque (`LocalRelayStorage`). L'interface `RelayStorage`
  est prévue pour un backend S3 (multipart + URL présignées : l'iPhone enverrait
  alors directement vers le bucket, sans passer par l'API).
- **Événements** en mémoire (un seul processus). Plusieurs workers → Redis pub/sub.
- **Schéma** créé au démarrage. Avant la production : migrations Alembic.
- **Workers de traitement Cloud** : arrivent avec la phase 6 (analyse sémantique).

## 6. Moteur IA hybride (phases 6–7, non construit)

Interface prévue, pour ne dépendre d'aucun fournisseur :

```python
class TranscriptionProvider(Protocol):      # local (whisper.cpp / faster-whisper) ou Cloud
    def transcribe(self, audio_path) -> Transcript: ...

class LLMProvider(Protocol):                # interchangeable (Claude, autre…)
    def complete(self, prompt, schema) -> dict: ...
```

- **Local** (agent) : transcription si la machine le permet (voir `audit`),
  détection de scènes (FFmpeg `scdet` / PySceneDetect), recadrage 9:16, montage
  et export FFmpeg, sous-titres.
- **Cloud** : uniquement sur le **texte** (transcription, liste de scènes),
  jamais la vidéo entière : scoring, accroches, titres, descriptions.

## 7. Sécurité

| Exigence | Mise en œuvre |
|---|---|
| Authentification par appareil | code d'appairage à usage unique (10 min, haché en base) → identité d'appareil |
| Jetons renouvelables | accès JWT 15 min ; rafraîchissement opaque 30 j, haché, **rotatif** ; réutilisation d'un ancien jeton = révocation de toute la session |
| Chiffrement | HTTPS (Caddy dans `docker-compose.yml`) ; l'app et l'agent refusent HTTP hors réseau local |
| Secrets | trousseau iOS / système ; `SCF_SECRET_KEY` ≥ 32 caractères obligatoire |
| Permissions minimales | rôles séparés : l'iPhone envoie, l'agent reçoit et traite, l'utilisateur administre. Lecture seule de la photothèque |
| Révocation | `DELETE /v1/devices/{id}` : effet immédiat sur jetons d'accès et de rafraîchissement |
| Journal d'activité | table `activity_log`, visible dans le dashboard |
| Contrôle d'accès | chaque requête filtrée par compte ; vidéo d'un autre compte = 404 ; URL de téléchargement signée, liée à l'appareil, 10 min |
| Jamais public par défaut | aucune route publique ; pas de publication sans validation (phase 8) |
| Pas de dossier exposé | l'agent n'ouvre aucun port : connexions sortantes uniquement |

## 8. Phases et état réel

| Phase | État |
|---|---|
| 1. Audit | `scf-agent audit` livré. **À lancer sur ton ordinateur.** |
| 2. App iOS | Code livré, **non compilé ici** (pas de Xcode dans cet environnement). À générer, signer et installer sur l'iPhone. |
| 3. Synchronisation | Protocole complet, testé de bout en bout côté serveur et agent. **Validation avec 10 vraies vidéos d'iPhone : à faire** (`tools/phase3_validate.py`). |
| 4. Agent desktop | Livré, testé sous Linux. **À tester sur ton Windows ou Mac.** |
| 5. Cloud | Livré (comptes, appareils, files, dashboard). Déploiement : `docker-compose.yml`. |
| 6. Analyse IA | Préparée : transcription locale, signaux, fournisseurs interchangeables, clips, Studio de validation. Voir `ARCHITECTURE_AI.md`. **Transcription et fournisseurs réels non encore essayés.** |
| 7–9. Montage, rendu, publication | Non commencées, volontairement. |

## 9. Critères de validation du MVP

| # | Critère | État |
|---|---|---|
| 1 | Autorisations Photos | code prêt, à tester sur iPhone |
| 2 | Détection des vidéos | code prêt, à tester sur iPhone |
| 3 | Import de 10 vidéos réelles | chaîne testée avec 10 vidéos générées ; à refaire avec l'iPhone |
| 4 | Reprise après interruption | testée (serveur : morceaux perdus ; agent : `.part`, redémarrage) |
| 5 | Intégrité vérifiée | testée (morceau corrompu, fichier global faux, `.part` corrompu) |
| 6 | L'ordinateur reçoit les vidéos | testé (agent Linux) ; à refaire sur ton ordinateur |
| 7 | L'IA analyse | chaîne construite et testée en mode démo / avec réponses simulées ; à essayer avec un vrai modèle |
| 8 | Extraits montés | non construit |
| 9 | Visionnage dans le dashboard | non construit |
| 10 | Aucune publication sans validation | garde `assert_publishable` testée ; aucune publication n'existe encore |
