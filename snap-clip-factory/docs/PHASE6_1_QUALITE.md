# Phase 6.1 — Validation réelle et qualité éditoriale

Date : 2026-11-04. Le montage automatique **n'est pas commencé** : il attend que la qualité de
sélection soit validée sur tes vidéos.

## 0. À lire d'abord

L'environnement de développement **ne contient aucune de tes vidéos** et **ne peut pas télécharger
de modèle Whisper** (constaté : `ProxyError 403 Forbidden`), ni appeler un fournisseur IA. La
validation sur vidéos françaises réelles **n'a donc pas pu être faite ici**. Cette phase livre les
outils pour la faire sur ton ordinateur (section 6), corrige trois défauts réels trouvés en
préparant ces outils, et sépare ci-dessous ce qui a été mesuré de ce qui ne l'a pas été.

## 1. Résultats réellement mesurés

Machine : conteneur Linux, 4 cœurs, 15,7 Go de RAM, sans GPU. Commande réellement exécutée :
`scf-agent bench --videos <10 vidéos> --model small --language fr`.

**Contenu des vidéos : synthétique** (plans de couleur, voix de synthèse anglaise flite, musique et
bruit générés). Les **temps** sont réels ; ils ne disent rien de la qualité de transcription.

| Vidéo | Durée | Format | Transcription | Traitement local* | × temps réel | Silence détecté |
|---|---|---|---|---|---|---|
| 01 dialogue court | 23 s | 540×960 H.264 | tentée → échec 403 | 1,46 s | 0,064 | 13,2 % |
| 02 dialogue vertical | 23 s | 1080×1920 H.264 | tentée → échec 403 | 1,20 s | 0,053 | 13,2 % |
| 03 horizontal | 23 s | 1920×1080 H.264 | tentée → échec 403 | 1,11 s | 0,049 | 13,2 % |
| 04 4K | 23 s | 3840×2160 H.264 | tentée → échec 403 | 1,88 s | 0,083 | 13,2 % |
| 05 HEVC (.mov) | 23 s | 1080×1920 H.265 | tentée → échec 403 | 1,50 s | 0,066 | 13,2 % |
| 06 sans audio | 23 s | 320×568 | `no_audio` (correct) | 0,39 s | 0,017 | — |
| 07 silencieuse | 14 s | 320×568 | `no_speech` (correct, moteur non appelé) | 0,54 s | 0,039 | 100 % |
| 08 voix faible (−24 dB) | 23 s | 720×1280 | tentée → échec 403 | 0,99 s | 0,044 | 13,2 % |
| 09 voix sur musique | 23 s | 720×1280 | tentée → échec 403 | 0,97 s | 0,043 | 0 % |
| 10 long | 294 s | 720×1280 | tentée → échec 403 | 6,55 s | 0,022 | 13,2 % |

\* inventaire, plans, extraction audio, silences, volume. **Sans la transcription**, qui sera
l'étape la plus longue sur ton ordinateur.

Constats mesurés :
- **Plans** : 6 changements trouvés sur 6 pour chaque vidéo de 23 s, 90 sur 90 pour la longue,
  en 4K et en HEVC compris. La 4K coûte environ 2 fois plus de temps de détection que le 540 p (1,3 s contre 0,45 s).
- **Silences** : 13,2 % mesurés pour 13,3 % réels (2 silences de 1,5 s et 1 s). Sur la vidéo 09, la musique de fond
  couvre ces pauses : 0 % est la bonne réponse.
- **Voix faible** : avec le seuil fixe de la phase 6 (−35 dB), **28,6 %** de la vidéo 08 était classée
  « silence » contre 13,3 % réels : des phrases dites doucement auraient été présentées à l'IA comme des
  silences. **Corrigé** (seuil adaptatif) : 13,2 % après correction. Test de non-régression ajouté.
- **Modèle de transcription introuvable** (hors ligne) : en phase 6, cela faisait **échouer toute la
  vidéo**. **Corrigé** : la transcription passe en `error` avec le motif, le reste de l'analyse continue.

Tests automatisés exécutés (aucune clé API, aucun réseau) :
- Cloud : **71 réussis** (62 de la phase 6, dont un adapté aux nouvelles catégories, et 9 nouveaux : 8 pour l'évaluation, 1 pour les catégories).
- Agent : **27 réussis** (20 de la phase 6, et 7 nouveaux : modèle introuvable hors ligne, voix faible, 4 sur les mesures de qualité de transcription, 1 banc complet).
- Studio vérifié dans un navigateur (ordinateur et iPhone 13 émulé) : sélection manuelle, refus avec
  motifs, onglet Évaluation, exclusion des clips simulés, options de retour désactivées par défaut,
  aucune erreur JavaScript, aucun débordement horizontal.

## 2. Résultats simulés (ne mesurent pas la qualité)

| Quoi | Pourquoi c'est simulé |
|---|---|
| Transcriptions dans les tests | double de test qui renvoie le texte connu du script (avec, pour le banc, une erreur volontaire de mot) |
| Propositions de clips dans les tests | fournisseur factice au niveau HTTP, réponses écrites à l'avance |
| Mode DÉMO du Studio | règles simples, chaque résultat est marqué DÉMO, **exclu des mesures** par défaut et impossible à valider |
| Décisions (accepter / refuser) dans la vérification du Studio | cliquées par le script de test pour vérifier l'interface, pas des avis éditoriaux |

Aucun chiffre de ces lignes ne doit être lu comme une performance du moteur.

## 3. Tests non réalisés

| Demandé | État |
|---|---|
| Installer et tester faster-whisper sur l'ordinateur | **paquet installé ici, modèle non téléchargeable** ; à faire sur ton ordinateur |
| Précision des mots en français, argot, expressions urbaines | **non réalisé** : nécessite tes vidéos et un modèle |
| Plusieurs interlocuteurs, changements de locuteur | **non réalisé**. De plus, faster-whisper **ne distingue pas les locuteurs** : le banc compte les changements dans ta référence et signale « non mesurable » |
| Rap / musique en fond, bruit ambiant, voix faibles et fortes | **signaux mesurés** sur synthèse (section 1) ; **transcription non mesurée** |
| Incertitudes | logique de marquage testée ; **calibration réelle** (les mots faux sont-ils signalés ?) **non mesurée** |
| Analyse éditoriale par un vrai modèle | **non réalisée** : aucune clé ni accès réseau aux fournisseurs |
| Test sur 10 vidéos réelles | **non réalisé** : protocole prêt (section 6) |
| Coût par vidéo réel | **non mesuré** (aucun appel réel ; tarifs non renseignés) |
| Taux d'acceptation, pertinence éditoriale | **non mesurables sans tes décisions** |

## 4. Ce qui a été construit dans cette phase

**Catégories** (adaptées aux réseaux sociaux) : punchline, moment drôle, anecdote, réaction, débat,
moment inattendu, coulisses, performance, moment émotionnel, phrase polémique. Les anciennes
catégories `humour` et `moment_fort` sont converties à la lecture. L'**explication est obligatoire** :
une proposition sans explication est rejetée et le motif est affiché. Une **phrase polémique** reçoit
toujours l'avertissement « vérifier le contexte et les personnes citées avant toute diffusion ».
La consigne au modèle précise de citer l'argot tel quel, sans le corriger ni le juger.

**Évaluation humaine** (Studio → Évaluation, `GET /v1/evaluation/report`) :
- **refus motivés** : 10 motifs (pas intéressant, hors contexte, mauvais début, mauvaise fin, transcription
  fausse, mauvaise catégorie, trop privé, qualité technique, doublon, autre) + précision libre ;
- **« passages que j'aurais choisis »** : saisis dans le détail d'une vidéo ; ils ne créent pas de clip,
  ils servent de référence. Le rapport donne la part retrouvée par l'IA (rappel, recouvrement ≥ 30 %),
  l'accord sur la catégorie et la liste des passages manqués ;
- taux d'acceptation global, **par catégorie, par tranche de score** (le score est utile seulement si le
  taux monte avec lui), par fournisseur et modèle ;
- **qualité des timecodes** : de combien tu déplaces le début et la fin des clips que tu acceptes ;
- **traitement** : temps local par étape, facteur temps réel, durée de l'analyse Cloud, coût, clips par vidéo ;
- **les résultats simulés sont toujours comptés à part**, et un avertissement s'affiche sous 30 décisions ;
- export JSON de toutes tes décisions.

**Amélioration du classement, sans entraînement** (2 options, **désactivées par défaut**) :
- *guidage* : ajoute à la consigne un résumé chiffré de tes décisions (taux par catégorie à partir de
  3 décisions, motifs de refus fréquents, tendance de recadrage). Aucune transcription passée, aucune
  note libre n'est envoyée (testé) ;
- *classement ajusté* : réordonne le Studio selon ton taux d'acceptation par catégorie, lissé, à
  ±10 points au plus. Le score d'origine reste affiché et inchangé.
Aucun modèle n'est entraîné ni ajusté. Ce serait une décision à part, à prendre explicitement.

**Banc d'essai de transcription** : `scf-agent bench` (section 6).

## 5. Limites techniques

- **Pas de diarisation** : les changements de locuteur ne sont pas détectés. Pour un contenu fait de
  conversations, c'est la première lacune à combler (recommandation 2).
- **Pas d'image** : le modèle ne voit pas la vidéo. Les réactions purement visuelles (une tête, un geste)
  et la plupart des « coulisses » ne peuvent être repérées que si elles s'entendent ou se disent.
- **Musique et parole** : le détecteur ne distingue pas un rap d'une conversation ; seule la
  transcription (et ses incertitudes) le révélera. Sur du rap avec instrumental, attends-toi à un taux
  d'erreur nettement plus élevé et à beaucoup de mots incertains : c'est à mesurer.
- **Seuil d'incertitude fixe** (probabilité 0,5) : à calibrer avec le banc sur tes références.
- **Rappel limité à ce que tu notes** : un passage que l'IA rate et que tu ne saisis pas comme
  « choisi » n'apparaît dans aucune mesure.
- Les mesures de temps de la section 1 viennent d'un conteneur sans GPU, sur un contenu simple ; tes
  vidéos réelles (plus de détail, plus de mouvement) seront plus longues à analyser.

## 6. Protocole du test sur 10 vidéos réelles (à faire sur ton ordinateur)

### Préparation
```bash
pip install "./desktop-agent[transcription]"   # faster-whisper
scf-agent audit                                # choisir le modèle : small sur CPU, medium/large-v3 avec GPU ou Apple Silicon
```

Choisis 10 vidéos qui couvrent la grille :

| # | Contenu | Durée | Qualité / format |
|---|---|---|---|
| 1 | conversation calme à deux | < 1 min | vertical, bonne qualité |
| 2 | conversation à 3+ personnes qui se coupent | 2-5 min | vertical |
| 3 | argot, expressions urbaines, verlan | 1-3 min | au choix |
| 4 | rap / freestyle avec instrumental | 1-3 min | au choix |
| 5 | conversation avec musique forte en fond (soirée, voiture) | 1-3 min | au choix |
| 6 | extérieur bruyant (rue, vent) | 1-3 min | au choix |
| 7 | voix faible ou lointaine | < 2 min | au choix |
| 8 | vidéo longue (studio, coulisses) | 10-20 min | 4K ou HEVC si possible |
| 9 | export Snapchat (qualité réduite) | < 1 min | partagée vers Snap Clip |
| 10 | sans parole (paysage, ambiance, musique seule) | < 1 min | au choix |

### A. Transcription (local, sans Cloud)
1. Mets les 10 fichiers dans un dossier.
2. Pour 3 à 5 d'entre eux, écris une **référence** : `<nom>.srt` (de préférence, avec `[Prénom]` en
   début de réplique pour les locuteurs) ou `<nom>.txt`. 1 à 2 minutes par vidéo suffisent : le banc
   compare sur la longueur de la référence, mot à mot.
3. Lance :
   ```bash
   scf-agent bench --videos ~/Bench --model small --language fr
   scf-agent bench --videos ~/Bench --model medium --language fr --out ~/Bench/rapport-medium
   ```
4. Lis `rapport/bench.md` : temps, × temps réel, WER, CER, part des mots faux signalés incertains,
   fausses alertes, écart des timecodes, changements de locuteur de la référence.

### B. Sélection éditoriale (chaîne complète)
1. Synchronise les 10 vidéos depuis l'iPhone (ou par l'extension de partage).
2. Studio → Réglages IA : choisis le fournisseur et le modèle, **renseigne les tarifs** pour obtenir le
   coût, laisse les deux options de retour **désactivées** pour la première série.
3. **Avant de regarder les propositions**, ajoute pour chaque vidéo les passages que tu choisirais
   toi-même (sinon tu seras influencé par l'IA).
4. Examine chaque proposition : accepte, recadre, ou refuse **avec un motif**.
5. Studio → Évaluation : relève les chiffres dans le tableau ci-dessous.

### Tableau à remplir

| Mesure | Valeur |
|---|---|
| Modèle de transcription, appareil | |
| WER médian (vidéos avec référence) | |
| Pire WER, et sur quel type de vidéo | |
| Part des mots faux signalés incertains | |
| Écart médian des timecodes | |
| Traitement local : × temps réel médian | |
| Fournisseur / modèle d'analyse | |
| Coût médian par vidéo | |
| Clips proposés par vidéo (médiane) | |
| Taux d'acceptation | |
| Taux d'acceptation par tranche de score (le score est-il utile ?) | |
| Rappel sur tes sélections manuelles | |
| Fin déplacée de plus de 1 s (part des clips acceptés) | |
| 3 motifs de refus les plus fréquents | |

### Critères proposés pour passer au montage (phase 7)
À valider ensemble, ce sont des propositions :
- au moins 30 propositions examinées ;
- taux d'acceptation ≥ 40 %, et plus élevé dans la tranche 80-100 que dans la tranche 40-59 ;
- rappel ≥ 50 % sur tes sélections manuelles ;
- au moins 70 % des clips acceptés dont les bornes bougent de 1 s au plus ;
- WER acceptable pour toi sur les conversations (à juger à la lecture : les sous-titres en dépendront).

## 7. Améliorations recommandées (par priorité)

1. **Faire le protocole de la section 6.** Sans ces chiffres, toute autre amélioration est à l'aveugle.
2. **Diarisation** (qui parle) : indispensable pour les débats et les réactions. Option locale :
   pyannote (modèle à télécharger, compte Hugging Face nécessaire). À évaluer avec le même banc.
3. **Vocabulaire** : fournir à Whisper une invite initiale (noms d'artistes, de lieux, argot récurrent)
   et mesurer le gain de WER.
4. **Séparation voix / musique** avant transcription pour le rap et les soirées (ex. Demucs, local) :
   à mesurer, coûteux en calcul.
5. **Calibrer le seuil d'incertitude** à partir de la calibration mesurée par le banc.
6. **Images clés** envoyées au modèle pour les réactions visuelles et les coulisses : demande ton accord,
   car ce seraient les premières données visuelles à quitter l'ordinateur.
7. Après une trentaine de décisions : comparer une série avec le *guidage* activé et une série sans,
   pour savoir s'il améliore vraiment le taux d'acceptation.

## 8. Fichiers créés et modifiés

| Fichier | Changement |
|---|---|
| `desktop-agent/scf_agent/processing.py` | échec de chargement du modèle non bloquant ; seuil de silence adaptatif ; temps par étape |
| `desktop-agent/scf_agent/signals.py` | `adaptive_noise_floor()` ; ratio de silence borné à 100 % |
| `desktop-agent/scf_agent/quality.py` | nouveau : WER, CER, alignement, calibration des incertitudes, timecodes, SRT et locuteurs |
| `desktop-agent/scf_agent/bench.py`, `__main__.py` | nouveau : commande `scf-agent bench` |
| `cloud/app/clips.py`, `ai/moments.py`, `ai/providers.py` | 10 catégories, conversion des anciennes, explication obligatoire, avertissement polémique |
| `cloud/app/evaluation.py` | nouveau : mesures, comparaison manuelle, guidage, classement ajusté |
| `cloud/app/models.py` | 2 tables **ajoutées** (`clip_feedback`, `manual_selections`) ; aucune table existante modifiée |
| `cloud/app/ai/config.py` | 2 options de retour, désactivées par défaut |
| `cloud/app/routers/studio.py`, `worker.py` | motifs de refus, journal des décisions, sélections, rapport, export, guidage |
| `cloud/app/static/studio.html` | onglet Évaluation, refus motivé, sélections manuelles, nouvelles catégories, options |
| tests | `cloud/tests/test_evaluation.py`, `desktop-agent/tests/test_quality.py`, ajouts dans `test_analysis.py` et `test_ai_moments.py` |
| synchronisation, app iOS, site | **aucune modification** |
