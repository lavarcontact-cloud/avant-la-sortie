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

## Tests

```bash
pip install fastapi sqlalchemy pyjwt httpx pytest websockets
cd cloud && pytest            # 20 tests : protocole, reprise, intégrité, sécurité
cd ../desktop-agent && pytest # 6 tests de bout en bout (vraie vidéo H.264 via ffmpeg)
```

## Ce qui est vérifié, et ce qui ne l'est pas encore

- **Vérifié ici** (Linux) : le Cloud et l'agent, de bout en bout. 10 vidéos sont
  envoyées par morceaux avec une coupure simulée sur chacune, reprises, vérifiées,
  rapatriées, identiques octet pour octet, analysées par ffprobe, et purgées du relais.
- **Non vérifié** : l'app iOS n'a pas été compilée (pas de Xcode ici), et rien
  n'a encore tourné sur un iPhone ni sur ton Windows/Mac. Ce sont les prochaines
  étapes, à faire sur tes appareils.
