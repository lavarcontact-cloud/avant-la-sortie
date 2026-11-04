# SNAP CLIP FACTORY — Moteur intelligent (phase 6)

Détection et préparation des clips. **Pas de montage ni de publication dans cette phase.**

## 1. Principe : la synchronisation et l'IA ne se touchent pas

```
 iPhone ──▶ Cloud (relais) ──▶ Ordinateur                         ← synchronisation (inchangée)
                                    │ vidéo VERIFIED, livrée
                                    ▼
                       AGENT : processing.py (local)
                       ffprobe · vignette · audio 16 kHz
                       plans · silences · volume · transcription
                       ──▶ work/analysis/<sha256>/ (fichiers locaux)
                                    │ TEXTE uniquement (≤ 2 Mo)
                                    ▼  POST /v1/videos/{id}/analysis-input
                       CLOUD : analysis_inputs ─▶ analysis_jobs ─▶ worker
                                    │ prompt texte, clé côté serveur
                                    ▼
                       Fournisseur IA (Anthropic · OpenAI · compatible · démo)
                                    │ propositions JSON
                                    ▼
                       VALIDATION SERVEUR ─▶ clips (READY_FOR_REVIEW)
                                    ▼
                       STUDIO /studio : revue humaine (accepter · refuser · timecodes)
```

Le seul point de contact avec la synchronisation est la lecture de l'état
`VERIFIED`/livré d'une vidéo. Les données de la phase 6 vivent dans quatre
tables **nouvelles** (`ai_configs`, `analysis_inputs`, `analysis_jobs`, `clips`) :
aucune colonne n'a été ajoutée aux tables existantes, ce qui évite d'avoir besoin
de migrations (audit I5).

## 2. Ce qui sort de l'ordinateur, et ce qui n'en sort jamais

| Reste sur l'ordinateur | Envoyé au Cloud | Envoyé au fournisseur IA |
|---|---|---|
| vidéo, audio extrait (effacé après calcul), mots détaillés avec leurs probabilités | texte des segments + timecodes, langue, plans, silences, volume par seconde, dimensions | le même texte et les mêmes signaux, mis en forme dans la consigne |

Le schéma d'entrée du Cloud est **strict** (`extra="forbid"`, 2 Mo maximum) : un champ
inattendu, par exemple des données vidéo encodées, est refusé (422). Testé.

## 3. Agent — analyse locale

Fichiers : `desktop-agent/scf_agent/processing.py`, `signals.py`, `transcription.py`.

| Étape | Outil | Remarques |
|---|---|---|
| Plans | ffmpeg `scdet` + saut de chrominance (`signalstats`) | image réduite à 320 px, 5 i/s, donc supportable en 4K. Le second détecteur rattrape les coupes entre plans de même luminosité (constaté sur les tests). |
| Silences | ffmpeg `silencedetect` (−35 dB, 0,6 s) | musique et bruit ambiant ne sont pas pris pour du silence (testé) |
| Volume | RMS par seconde (`astats`) | sert aux pics sonores (réactions, rires, musique) |
| Transcription | **faster-whisper**, local, optionnel | langue détectée, timecodes par segment et par mot, `vad_filter`, `condition_on_previous_text=False` contre les répétitions inventées |

Règles de transcription :
- mot dont la probabilité est sous `uncertain_word_probability` (0,5) → écrit `[mot?]`, jamais corrigé ;
- `speaker` : faster-whisper ne distingue pas les locuteurs, le champ reste vide. Il sera rempli si un moteur de diarisation est branché ;
- pas de piste audio → `no_audio` ; audio silencieux à 98 % → `no_speech`, sans appeler le moteur ;
- moteur absent → `unavailable` ; moteur en panne → `error`. Dans ces cas, l'analyse continue avec les plans, silences et volume, et le dit ;
- **reprise** : le résultat est mis en cache par SHA-256 ; une coupure réseau pendant l'envoi ne relance pas la transcription.

Configuration (`config.json` de l'agent) : `analysis_enabled`, `transcriber` (`auto` | `faster-whisper` | `none`),
`whisper_model` (`tiny` … `large-v3`), `whisper_device`, `language` (`auto` ou code), `uncertain_word_probability`,
`scene_threshold`.

## 4. Cloud — fournisseurs interchangeables

Fichiers : `cloud/app/ai/`.

```python
class LLMProvider(Protocol):
    name: str; model: str; simulated: bool
    def complete(self, request: LLMRequest) -> LLMResponse: ...
```

| Fournisseur | Classe | Configuration serveur |
|---|---|---|
| `demo` | `DemoProvider` | aucune. Règles simples, résultats **marqués SIMULÉS** |
| `anthropic` | `AnthropicProvider` (API Messages) | `SCF_ANTHROPIC_API_KEY` |
| `openai` | `OpenAIChatProvider` (Chat Completions) | `SCF_OPENAI_API_KEY` |
| `openai_compatible` | `OpenAIChatProvider` + `base_url` | `SCF_OPENAI_COMPAT_BASE_URL` (+ `SCF_OPENAI_COMPAT_API_KEY` facultatif, `SCF_OPENAI_COMPAT_JSON_MODE=0` si le serveur ne gère pas le mode JSON) |

Modèles locaux : le plus simple est de passer par `openai_compatible` (Ollama, vLLM, LM Studio
exposent cette API). Ajouter un autre fournisseur = une classe + une ligne dans `make_provider()`.

**Secrets** : uniquement dans l'environnement du serveur (`SCF_<NOM>`) ou un fichier
(`SCF_<NOM>_FILE`, pour les secrets Docker). Jamais en base, jamais renvoyés par l'API
(testé : `/v1/ai/providers`, `/v1/ai/config` et le journal ne contiennent pas les clés),
jamais dans l'app iPhone. L'URL du serveur compatible est aussi côté serveur, pour qu'on
ne puisse pas faire appeler une adresse arbitraire depuis le Studio.

Erreurs : 408/409/425/429/5xx/529, délai dépassé, réseau, réponse illisible → **passagère**
(4 essais, délai 30 s → 4 min). 400/401/403/404, clé ou modèle absents → **définitive**, sans nouvel essai.

## 5. Configuration centralisée (par compte, depuis le Studio)

| Champ | Défaut | Rôle |
|---|---|---|
| `provider` | `demo` | aucun fournisseur imposé |
| `model` | vide = défaut du fournisseur | champ libre ; suggestions affichées |
| `language` | `auto` | langue des titres et explications |
| `level` | `standard` | `rapide` / `standard` / `approfondi` : taille des fenêtres (12 k / 24 k / 40 k caractères), réponse max., propositions par fenêtre |
| `max_cost_per_video_usd` | 0,50 | vérifié **avant** tout appel |
| `daily_budget_usd` | 5,0 | idem |
| `max_input_chars` | 200 000 | taille maximale d'une transcription envoyée |
| `max_clips_per_video`, `min_clip_s`, `max_clip_s` | 8, 5, 60 | |
| `price_input_per_mtok`, `price_output_per_mtok` | **non renseignés** | je n'ai pas inscrit de tarifs : ils changent et je ne veux pas en inventer. Sans eux, le coût est « inconnu » et seule la limite de taille s'applique. |
| `auto_analyze` | oui | analyser chaque nouvelle vidéo reçue |

L'estimation de jetons est volontairement prudente (≈ 3 caractères par jeton).

## 6. Détection des moments

Fichier : `cloud/app/ai/moments.py`.

1. **Fenêtres** : les longues transcriptions sont découpées, avec un chevauchement de 2 segments
   pour ne pas couper un moment en deux. Chaque fenêtre analysée est enregistrée : une tâche
   interrompue repart de la suivante (testé).
2. **Consigne** : n'utiliser que le texte et les signaux ; ne rien inventer ; le modèle ne voit pas
   l'image ; le score mesure le **potentiel éditorial** (compréhensible seul, début et fin nets, force,
   émotion), **pas une prédiction de popularité** ; ne pas citer comme sûrs les mots `[x?]` ; `{"clips": []}`
   s'il n'y a rien de bon.
3. **Validation par le serveur** (le modèle propose, le serveur vérifie) :
   - catégorie hors liste → rejet ; fin avant début, hors vidéo, timecodes non numériques → rejet ;
   - timecodes ramenés dans la vidéo, recalés à ±1 s sur les débuts/fins de segments, durée bornée ;
   - **l'extrait de transcription est recopié par le serveur** depuis la vraie transcription ;
   - la citation du modèle doit s'y retrouver, sinon avertissement « citation introuvable » et confiance divisée par 2 ;
   - doublons entre fenêtres fusionnés (recouvrement > 50 %), meilleur score conservé ;
   - les motifs de rejet sont visibles dans le Studio.
4. Une réponse illisible n'est **jamais** lue comme « 0 clip » : c'est une erreur passagère.

Catégories : `punchline`, `anecdote`, `humour`, `reaction`, `performance`, `moment_fort`.
Rattachements : phrase marquante → punchline ; tension ou surprise → reaction ou moment_fort ;
émotion → moment_fort ; musique, chant, danse → performance. Les nuances vont dans `tags`.

**Limite assumée** : sans image, la `scene_description` ne décrit que ce que le son et le texte
permettent d'affirmer. Une analyse visuelle (images clés envoyées à un modèle de vision) demanderait
d'envoyer des images de la vidéo : ce serait un choix à faire explicitement, non activé.

## 7. Clips et validation humaine

Fichiers : `cloud/app/clips.py`, `cloud/app/models.py` (`Clip`).

```
DETECTED ─▶ ANALYZED ─▶ READY_FOR_REVIEW ─▶ APPROVED ─▶ RENDERED
                              ▲   │   ▲         │            │
                              │   ▼   └─────────┴────────────┘   modification = nouvelle revue
                              └ REJECTED
```

Champs : identifiant, vidéo, début/fin (+ proposition d'origine), extrait de transcription, description
de scène, catégorie, tags, titre, explication, score 0-100, justification, confiance 0-1, citation et sa
vérification, avertissements, format (9:16, ou « recadrage » si la source est horizontale), durée,
état, historique daté de chaque transition, note de revue, auteur et date de validation, chemin du rendu
(phase 7), fournisseur, modèle, `simulated`.

Garanties (toutes testées) :
- seul un **compte utilisateur** peut valider : jeton d'iPhone ou d'agent → 403 ;
- un clip **simulé** (démo) ne peut jamais être validé ;
- toute modification après validation (timecodes, titre) **révoque** la validation ;
- `assert_publishable(clip)` exige : état APPROVED ou RENDERED, validation humaine enregistrée,
  empreinte de validation identique à l'état actuel, clip non simulé. Écrire `APPROVED` directement en
  base ne suffit pas ;
- **aucune route de publication n'existe** dans cette phase (vérifié sur le schéma OpenAPI). La phase 9
  devra appeler `assert_publishable()` juste avant chaque envoi.

## 8. Studio — `/studio`

Page séparée du dashboard de synchronisation, même session de connexion. Mobile d'abord.
- **Vidéos** : état, transcription (langue, moteur), analyse (fournisseur, modèle, coût), nombre de clips, « Analyser à nouveau ».
- **Transcription** horodatée, mots incertains soulignés, propositions écartées par le serveur et leurs motifs.
- **Clips** : filtres catégorie, score minimum, état, vidéo ; timecodes modifiables (`m:ss.s`) ;
  proposition d'origine rappelée ; citation vérifiée ou non ; accepter / refuser / remettre en revue.
- **Réglages IA** : fournisseur (avec « non configuré sur le serveur »), modèle, langue, niveau, limites, tarifs, consommation.
- Mises à jour en temps réel par le WebSocket existant.
- **Visionnage** : impossible pour l'instant, les vidéos sont sur l'ordinateur et non dans le Cloud.
  Ce sera l'objet du critère 9 (aperçus basse résolution envoyés par l'agent), à décider plus tard.

## 9. Journal des modifications de la phase 6

| Fichier | Nature |
|---|---|
| `desktop-agent/scf_agent/agent.py` | correctifs B1 (réconciliation à chaque cycle) et B2 (erreur réseau du traitement → nouvel essai) ; envoi des données d'analyse. **Téléchargement et livraison inchangés.** |
| `desktop-agent/scf_agent/processing.py` | ajout de l'analyse locale et du cache ; inventaire et vignette inchangés |
| `desktop-agent/scf_agent/{signals,transcription,processing_tools}.py` | nouveaux |
| `desktop-agent/scf_agent/config.py` | options d'analyse ajoutées |
| `desktop-agent/pyproject.toml` | extra facultatif `transcription` (faster-whisper) |
| `cloud/app/ai/*`, `clips.py`, `worker.py`, `routers/studio.py`, `static/studio.html` | nouveaux |
| `cloud/app/models.py` | 4 tables ajoutées en fin de fichier ; tables existantes inchangées |
| `cloud/app/main.py`, `config.py` | branchement du routeur Studio et du worker (`SCF_AI_WORKER`) |
| `cloud/app/routers/dashboard.py`, `static/dashboard.html` | route `/studio` et lien « Studio → » |
| `cloud/docker-compose.yml`, `.env.example` | variables des fournisseurs IA |
| `ios/` | **aucune modification** |
| site « Avant la sortie » | **aucune modification** |

## 10. Limites connues

- **Transcription réelle non testée** : aucun modèle Whisper n'est téléchargeable dans l'environnement
  de développement. L'adaptateur est testé avec un module factice qui imite l'API de faster-whisper ;
  la qualité réelle (français, argot, voix qui se chevauchent) reste à mesurer sur tes vidéos.
- **Fournisseurs IA réels non appelés** : les adaptateurs sont testés au niveau HTTP avec des réponses
  écrites à l'avance, sans clé. Le premier appel réel validera le format et la qualité des propositions.
- **Voix de test synthétiques et anglaises** (flite) : elles valident les signaux et la chaîne, pas la reconnaissance vocale.
- Pas de diarisation (locuteurs), pas d'analyse visuelle, pas de lecture vidéo dans le Studio.
- Worker : un seul processus suffit à l'usage visé (20 à 50 vidéos par jour). Plusieurs workers
  fonctionneraient (prise de tâche atomique), mais n'ont pas été testés en concurrence.
