# SNAP CLIP FACTORY

Écosystème personnel de clipping : iPhone → Cloud (relais) → ordinateur.
Cette première livraison couvre **la chaîne de synchronisation** (phases 1 à 5).
L'analyse IA, le montage et la publication viennent ensuite.

Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
snap-clip-factory/
├── cloud/           API FastAPI + dashboard web
├── desktop-agent/   agent Windows / macOS (scf-agent)
├── ios/             app SwiftUI + extension de partage (XcodeGen)
├── tools/           validation de la phase 3
└── docs/
```

## Premier essai sur PC Windows (sans iPhone)

Guide pas à pas : [`docs/PREMIER_ESSAI_WINDOWS.md`](docs/PREMIER_ESSAI_WINDOWS.md).
`scf-agent import <vidéo>` fait entrer une vidéo du PC dans le système par le même protocole que l'iPhone.

## Démarrage

### 1. Cloud

En local, pour essayer :

```bash
cd cloud
pip install -r requirements.txt
export SCF_SECRET_KEY="$(openssl rand -base64 48)"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Ouvre http://localhost:8000, crée ton compte (seul le premier compte peut
s'inscrire), puis clique sur **Appairer un appareil** pour obtenir un code.

En production : renseigne `cloud/.env` à partir de `.env.example`, puis
`docker compose up -d` (API, PostgreSQL et Caddy pour le HTTPS automatique).

### 2. Ordinateur (phases 1 et 4)

```bash
cd desktop-agent
pip install .
scf-agent audit                                    # phase 1
scf-agent pair --server https://ton-serveur --code XXXXXXXX
scf-agent run                                      # ou : scf-agent autostart enable
```

FFmpeg est requis (`brew install ffmpeg` / `winget install ffmpeg`).

### 3. iPhone (phase 2)

Sur un Mac avec Xcode :

```bash
brew install xcodegen
cd ios && xcodegen generate && open SnapClipMobile.xcodeproj
```

Choisis ton équipe de signature sur les deux cibles, branche l'iPhone, lance.
Saisis l'adresse du serveur et un nouveau code d'appairage, autorise l'accès aux
Photos, puis touche **SYNCHRONISER MAINTENANT**.

### 4. Valider la phase 3 avec de vraies vidéos

```bash
python tools/phase3_validate.py --server https://ton-serveur --email toi@… \
       --library ~/Movies/SnapClipFactory --count 10
```

Le script lit l'état réel du Cloud et re-hache les fichiers reçus sur l'ordinateur.

## Phase 6 — détection des clips

Documentation : [`docs/ARCHITECTURE_AI.md`](docs/ARCHITECTURE_AI.md). Audit préalable : [`docs/AUDIT_PHASE6.md`](docs/AUDIT_PHASE6.md).

```bash
# Ordinateur : transcription locale (facultative mais recommandée)
pip install "./desktop-agent[transcription]"     # faster-whisper ; le modèle se télécharge au premier usage
scf-agent run                                     # chaque vidéo reçue est analysée puis envoyée en texte

# Serveur : choisir un fournisseur (sinon mode DÉMO, résultats simulés)
export SCF_ANTHROPIC_API_KEY=…                    # ou SCF_OPENAI_API_KEY, ou SCF_OPENAI_COMPAT_BASE_URL
uvicorn app.main:app --host 0.0.0.0 --port 8000   # le worker d'analyse tourne dans le même processus
# (variante : SCF_AI_WORKER=0 pour l'API, et `python -m app.worker` à part)
```

Puis ouvre **http://localhost:8000/studio** → *Réglages IA* : fournisseur, modèle, langue,
niveau, limites et tarifs. Les clips proposés arrivent dans l'onglet *Clips*, où tu les acceptes,
refuses ou recadres. Rien n'est publié : aucune publication n'existe à ce stade, et la future
publication exigera une validation humaine (`assert_publishable`).

Réglages de l'agent (`config.json` dans le dossier de l'agent) : `transcriber`, `whisper_model`
(`small` par défaut ; `medium` ou `large-v3` si `scf-agent audit` recommande le local), `language`.

## Phase 6.1 — mesurer la qualité

Rapport et protocole du test sur 10 vidéos réelles : [`docs/PHASE6_1_QUALITE.md`](docs/PHASE6_1_QUALITE.md).

```bash
scf-agent bench --videos ~/Bench --model small --language fr   # transcription : temps, WER, incertitudes, timecodes
```

Studio → *Évaluation* : taux d'acceptation, motifs de refus, comparaison avec les passages que tu aurais choisis, temps et coûts.

## Tests

```bash
pip install fastapi sqlalchemy pyjwt httpx pytest websockets
cd cloud && pytest            # 71 tests : synchronisation, sécurité, fournisseurs IA, clips, validation
cd ../desktop-agent && pytest # 30 tests : chaîne réelle + analyse sur vidéos synthétiques (ffmpeg + flite)
```

## Ce qui est vérifié, et ce qui ne l'est pas encore

- **Vérifié ici** (Linux) : le Cloud et l'agent, de bout en bout. 10 vidéos sont
  envoyées par morceaux avec une coupure simulée sur chacune, reprises, vérifiées,
  rapatriées, identiques octet pour octet, analysées par ffprobe, et purgées du relais.
- **Non vérifié** : l'app iOS n'a pas été compilée (pas de Xcode ici), et rien
  n'a encore tourné sur un iPhone ni sur ton Windows/Mac. Ce sont les prochaines
  étapes, à faire sur tes appareils.
