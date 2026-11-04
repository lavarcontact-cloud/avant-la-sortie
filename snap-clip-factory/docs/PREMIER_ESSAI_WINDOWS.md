# Premier essai sur PC Windows, sans iPhone

But : analyser **une vraie vidéo de 1 à 5 minutes** sur ton PC et voir les propositions dans le
Studio. Ton original n'est jamais modifié : le système travaille sur des copies.

Ce parcours a été rejoué tel quel (sous Linux, avec les mêmes commandes) le 2026-11-04 :
import, appairage, traitement et affichage dans le Studio fonctionnent. **Il n'a pas été exécuté
sous Windows** : signale-moi toute erreur avec son message exact.

## 0. Outils

- Windows 10/11 64 bits, environ 10 Go libres.
- **Python 3.11 ou plus récent** (3.11, 3.12 et 3.13 conviennent ; les tests tournent ici en 3.13).
  À l'installation, coche « Add python.exe to PATH ».
- **Git** pour Windows.
- **FFmpeg : obligatoire.** Whisper n'en a pas besoin, mais l'agent l'utilise pour l'inventaire, les
  plans, l'extraction audio et les silences. Sans FFmpeg, l'analyse échoue. Le plus simple :
  ```powershell
  winget install Gyan.FFmpeg
  ```
  puis **ferme et rouvre PowerShell**, et vérifie : `ffmpeg -version` et `ffprobe -version`.
- Docker : inutile pour ce premier essai.

## 1. Récupérer le projet

```powershell
git clone -b claude/snap-clip-factory-v3-wbq74m https://github.com/lavarcontact-cloud/avant-la-sortie.git
cd avant-la-sortie\snap-clip-factory
```
Déjà cloné : `git switch claude/snap-clip-factory-v3-wbq74m` puis `git pull`, et `cd snap-clip-factory`.

## 2. Environnement Python (une seule fois)

Depuis `snap-clip-factory` :
```powershell
py -3.11 -m venv .venv            # ou : py -3.12 / py -3.13
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install ".\desktop-agent[transcription]"
pip install -r .\cloud\requirements.txt
scf-agent audit
```
Un seul environnement sert à la fois à l'agent et au Cloud. **Dans chaque nouvelle fenêtre
PowerShell**, refais `Set-ExecutionPolicy …` et `.\.venv\Scripts\Activate.ps1` (depuis `snap-clip-factory`).

`scf-agent audit` affiche processeur, RAM, carte graphique, FFmpeg, espace disque, et une recommandation
de modèle. Envoie-moi ce résultat : il remplace les commandes `Get-CimInstance`.

## 3. Transcription seule (sans Cloud)

```powershell
New-Item -ItemType Directory -Force C:\SCF-Test\Videos
# copie UNE vidéo dans C:\SCF-Test\Videos (une copie, pas ton original)
scf-agent bench --videos C:\SCF-Test\Videos --model small --language fr
```
- Le premier lancement **télécharge le modèle** `small` (environ 500 Mo). Un avertissement sur les
  « symlinks » de Hugging Face sous Windows est sans gravité.
- Résultat : `C:\SCF-Test\Videos\rapport\bench.md`.
- **Réussi** seulement si la colonne *Statut* indique `ok` et la colonne *Langue* `fr`. Si elle indique
  `error` avec `403`, `ProxyError` ou `ConnectionError` dans les remarques, **la transcription n'a pas eu
  lieu** : le modèle n'a pas pu être téléchargé.
- Pour mesurer la précision, écris à côté de la vidéo une référence `test.srt` ou `test.txt` (1 à 2 minutes
  suffisent), puis relance : le rapport ajoute le taux d'erreur de mots (WER).

## 4. Cloud local (fenêtre PowerShell n° 1)

```powershell
cd chemin\vers\avant-la-sortie\snap-clip-factory
.\.venv\Scripts\Activate.ps1
cd cloud
$env:SCF_SECRET_KEY = "remplace-par-une-longue-phrase-secrete-d-au-moins-32-caracteres"
# facultatif, pour une vraie IA (sinon mode DÉMO) :
# $env:SCF_ANTHROPIC_API_KEY = "ta-cle"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- `SCF_SECRET_KEY` : sans elle, le serveur en invente une à chaque démarrage et tu dois te reconnecter
  au dashboard à chaque redémarrage. Garde la même phrase d'une fois sur l'autre.
- La clé API se définit **dans cette fenêtre, avant** de lancer uvicorn. Pour la changer : `Ctrl+C`,
  nouvelle valeur, relance.
- Les données locales sont dans `cloud\scf.db` et `cloud\relay\`.

Ouvre **http://127.0.0.1:8000** :
1. saisis un email et un mot de passe (**10 caractères minimum**) puis **Créer le compte**, puis **Se connecter**.
   Seul le premier compte peut être créé ;
2. clique **Appairer un appareil** : un code de 8 caractères s'affiche (valable 10 minutes, une seule utilisation).

## 5. Faire entrer ta vidéo, sans iPhone (fenêtre n° 2)

```powershell
cd chemin\vers\avant-la-sortie\snap-clip-factory
.\.venv\Scripts\Activate.ps1
scf-agent import C:\SCF-Test\Videos\test.mp4 --server http://127.0.0.1:8000 --code CODE1234
```
- `--code` : un code d'appairage **neuf** du dashboard (étape 4.2). Seulement la première fois ;
  ensuite `scf-agent import C:\SCF-Test\Videos` suffit (les vidéos déjà importées sont ignorées).
- La vidéo est envoyée par le même protocole que l'iPhone (morceaux, SHA-256, reprise après coupure).
  Dans le dashboard, cet import apparaît comme un appareil « Import PC (sans iPhone) ».
- Attendu : `test.mp4 : VERIFIED (… Mo, intégrité vérifiée)`.

## 6. Agent de traitement (même fenêtre n° 2)

Génère **un autre** code d'appairage dans le dashboard, puis :
```powershell
scf-agent pair --server http://127.0.0.1:8000 --code CODE5678 --library C:\SCF-Test\Bibliotheque
scf-agent run
```
- `run` tourne en continu ; `Ctrl+C` pour l'arrêter. Il récupère la vidéo, vérifie son empreinte,
  la range dans `C:\SCF-Test\Bibliotheque\AAAA\MM\…`, l'analyse et envoie **le texte seulement**.
- Ligne à surveiller : `traitée : test.mp4 — transcrite (fr, N segments)`. Si tu vois
  `SANS transcription : …`, la transcription a échoué (motif indiqué) et les propositions ne
  s'appuieront que sur le son.
- Dans une 3e fenêtre (environnement activé) : `scf-agent status`.
- L'agent **refuse de télécharger s'il reste moins de 5 Go** sur le disque de la bibliothèque.
- Journal : `%APPDATA%\SnapClipFactory\agent.log`.

## 7. Studio

Ouvre **http://127.0.0.1:8000/studio** (lien « Studio → » dans le dashboard).
- *Vidéos* → **Transcription et clips** : transcription horodatée, mots incertains soulignés.
- *Réglages IA* : fournisseur (Démo, ou Anthropic si la clé est définie à l'étape 4), modèle, et
  **tarifs** (à recopier depuis la grille du fournisseur ; sans eux le coût reste « inconnu »).
  Après un changement de fournisseur : *Vidéos* → **Analyser à nouveau**.
- *Clips* : accepter, recadrer, refuser **avec un motif**.
- Avant de lire les propositions, note dans la fiche de la vidéo **les passages que tu aurais choisis** :
  c'est ce qui permet de mesurer ce que l'IA rate (onglet *Évaluation*).

En mode **Démo**, les propositions sont des règles simples marquées DÉMO : elles vérifient le parcours,
pas la qualité. Pour juger la qualité, il faut un vrai fournisseur.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| `scf-agent` n'est pas reconnu | environnement non activé dans cette fenêtre |
| `ffmpeg introuvable` | FFmpeg non installé, ou PowerShell non rouvert après l'installation |
| `code d'appairage invalide ou expiré` | code déjà utilisé ou de plus de 10 min : en générer un neuf |
| `Refus : le serveur doit être en HTTPS` | adresse autre que `http://127.0.0.1` / `http://localhost` |
| Dashboard : « session expirée » après redémarrage du Cloud | `SCF_SECRET_KEY` absente ou changée : se reconnecter |
| Transcription `error` avec 403 / ConnectionError | modèle non téléchargé : vérifier la connexion, le pare-feu ou le proxy |
| Réglages IA : « non configuré sur le serveur » | clé API non définie dans la fenêtre du Cloud avant uvicorn |
