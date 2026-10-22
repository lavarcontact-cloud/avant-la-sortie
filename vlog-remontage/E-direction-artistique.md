# Livrable E — Direction artistique

**Principe :** l'habillage du vlog reprend le langage visuel de ton portfolio (« Avant la sortie ») : timecode, viseur, accent corail unique. Le vlog et le site portent ainsi la même signature de réalisateur, au lieu d'un template YouTube générique.

## 1. Typographies et hiérarchie

| Niveau | Police | Usage | Exemple |
|---|---|---|---|
| Punch | **Bricolage Grotesque** ExtraBold, capitales | Un seul mot qui frappe, 1 à 2 fois par séquence maximum, uniquement des mots dits ou lus à l'image | REFUSÉ · LE CONCERT |
| Repère | **Space Mono** Regular, capitales, interlettrage +50 | Heure, lieu, jour, compteur : tout ce qui est factuel | 21:26 · LIGNE 4 · GARE DU NORD · 02:23 |
| Nom | Bricolage Grotesque Bold + trait corail qui se dessine | Artistes et personnes **confirmés** uniquement | KLM |
| Annotation | Inter Medium, ou trait dessiné à la main | Flèches et petits commentaires en tracking | « nouvelles lunettes » |

- Couleurs : texte `#F6F3EC`, accent unique `#FF5B3C`, ombre portée noire à 40 %. Le corail est réservé aux moments clés : REFUSÉ, LE CONCERT, trait sous un nom confirmé.
- Lisibilité : hauteur minimale de 5 % de l'image, jamais sur un visage, marge de sécurité de 5 %.
- Durée à l'écran : au moins 1 s pour un mot, au moins 2 s pour un repère.

## 2. Principes de motion design
- Entrées en **4 à 6 images**, sorties en **3 images**. Easing fort en sortie (ease-out expo). Pas de rebond cartoon.
- **Aucun texte à l'écran sans source** : chaque texte est dit par lui ou lu à l'image (voir F-verifications.md). Pas de compteur de jours : l'écart n'est pas établi.
- Tracking (annotations, flèches) : seulement quand l'objet bouge peu et que l'info est utile.
- Freeze frame : maximum **un par séquence**, toujours sur une réaction. Détourage + contour corail réservés à 3 ou 4 moments dans toute la vidéo (REFUSÉ, gag TikTok, « historique », téléphone).
- Split screen : uniquement pour les actions parallèles ou en série (le parfum, le récap de la semaine).
- **Plans verticaux** (la moitié des scènes de rue) : jamais de bandes noires. Fond flouté pour la parole, **triptyque** pour l'énergie (foule, performance), split 2 × 9:16 pour le parallèle. Le triptyque devient une signature du vlog : c'est lui qui donne le look « réalisateur » au contenu tourné au téléphone. Le retour au **plein cadre 16:9** est réservé aux moments forts (entrée du concert, Sony, chez KLM), pour que le changement de format se ressente.

## 3. Transitions
| Type | Quand | Exemples |
|---|---|---|
| **Coupe sèche** (par défaut, ~80 %) | Partout | — |
| Coupe au silence | Avant une phrase choc | « Ils m'ont dit non » |
| Whip pan / whoosh | Changement de lieu en mouvement | arrivée chez KLM, métro |
| Match cut | Même geste ou forme d'un lieu à l'autre | porte de métro → porte de Sony |
| Masque sur objet | Entrée dans un lieu fort | logo Sony |
| **Exceptionnelles** (2 ou 3 au total) | Bascules de récit | carton LE CONCERT, stutter « dinguerie » |

## 4. Traitement des artistes et des lieux
- **Aucun nom à l'écran sans confirmation** de l'identité à l'image et de l'orthographe.
- Les artistes du concert ou chez KLM : traitement « coulisses ». Son direct, caméra à hauteur d'homme, pas de musique ajoutée sous leurs paroles.
- Une **introduction marquée** (carton nom + basse) pour au plus deux personnes dans la vidéo. Les autres apparaissent naturellement, sans carton.
- Lieux : un repère Space Mono quand on arrive (BARBÈS, NATION, GARE DU NORD). Une mini-carte animée seulement pour les trajets dits à voix haute (Rosa Parks → Porte de la Chapelle).
- Personnes privées identifiables (passants, salariés, l'attachée de presse) : pas de nom, flouter si la personne n'a pas consenti à être filmée.

## 5. Rythme
- Scènes parlées : jump cuts sur chaque respiration. Un plan parlé ne dépasse pas ~6 s sans changement de cadrage (coupe, punch-in, plan de coupe).
- **Une respiration toutes les 2 à 3 minutes** : 5 à 10 s sans texte ni effet (retouche photo, assis sur le sac, Gare du Nord la nuit).
- Morceaux / performances : **45 s maximum d'affilée**, puis retour à la parole.
- Une **relance** (question, compteur, rappel) au moins toutes les 90 s.

## 6. Palette sonore
- **Base : le son direct.** C'est lui qui fait l'immersion.
- **Remise à niveau d'abord** : l'export actuel varie de -12 à -29 LUFS selon les scènes. Toute scène parlée doit être à -16 LUFS (± 1) avant d'ajouter le moindre effet. Référence d'écoute : `remontage_audio_v1.mp3`.
- **Aucun trou de son** : l'export a 1:50 de silence numérique (10:40 → 12:30). Toute image doit avoir au moins une ambiance.
- Impacts graves (sub 40-60 Hz) : uniquement sur les punchs (REFUSÉ, carton LE CONCERT, coupe du concert).
- Whooshes : sur les whip pans et les cartes de lieu, pas sur chaque coupe.
- **Silence** : outil principal de rupture. 4 à 8 images de silence avant une phrase choc.
- Sons comiques : 3 ou 4 dans toute la vidéo (disque rayé, pschitt, bus qui part).
- Musique : uniquement des titres **libres de droits ou sous licence** (bibliothèque type Epidemic / Artlist, ou des prods dont tu as l'accord). Ne rien mettre sous la voix au-dessus de -18 dB. Ducking automatique de 8 à 10 dB sous les dialogues.
- Morceaux d'artistes (live, clips) : extraits courts. Pour une monétisation sûre, demande l'accord écrit des artistes ou de leur label.

## 7. Étalonnage
- Partir de l'export : corrections **légères** seulement (l'image est déjà compressée).
- Priorité aux scènes de nuit presque noires (1:15 → 3:55, 36:05) : remonter les noirs et les tons moyens, accepter un peu de bruit plutôt qu'une image illisible. Si un plan reste illisible, le couper.
- Une balance de base par lieu ou journée pour unifier les plans caméra et téléphone : correction de la balance des blancs, noirs légèrement relevés (pas de noir écrasé).
- Look : contraste modéré, saturation -5 à -10 %, peaux protégées (qualifieur sur les tons chair). Grain fin optionnel pour fondre caméra et téléphone.
- Pas de LUT « cinéma » appliquée à fond : avec un export 8 bits, ça bande et ça dégrade.

## 8. Export
| Destination | Réglages |
|---|---|
| YouTube (principal) | Résolution native de la source (ne pas upscaler), cadence d'origine, H.264 High, VBR 2 passes, **16 Mb/s en 1080p** (35-45 Mb/s en 4K), AAC 320 kb/s 48 kHz |
| Loudness | **-14 LUFS intégré**, true peak **-1 dBTP**. Dialogues autour de -16 à -14 LUFS court terme |
| Shorts / Reels / TikTok | 1080×1920, même cadence, H.264 ~12 Mb/s, -14 LUFS, textes dans la zone sûre centrale (éviter les 15 % du bas et la colonne de droite) |
| Sous-titres | Exporter un `.srt` propre (corrigé à la main), pas les sous-titres automatiques |
