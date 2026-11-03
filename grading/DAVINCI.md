# Look "FP9 nuit froide" — DaVinci Resolve (Sony A7R IV, PP7 = S-Gamut / S-Log2)

## Installer les LUT
Project Settings > Color Management > **Open LUT Folder** → copier les `.cube` → **Update Lists**.

- `fp9_nuit_froide_slog2.cube` : tout-en-un, entrée S-Log2 (version rapide, 1 nœud)
- `fp9_nuit_froide.cube` : look seul, entrée Rec.709 (à mettre après un CST, recommandé)

## Arbre de nœuds (série)

| # | Nom | Réglages |
|---|-----|----------|
| 01 | EXPO / WB | Sur le log : **Offset** pour l'expo, **Temp/Tint** pour la balance. But : peau neutre, gris neutre. |
| 02 | CST | ResolveFX **Color Space Transform** : In = *Sony S-Gamut* / *Sony S-Log2* → Out = *Rec.709* / *Gamma 2.4*. Tone Mapping = *DaVinci*, Gamut Mapping = *Saturation Compression*. |
| 03 | LOOK | Clic droit > LUTs > `fp9_nuit_froide.cube`. Doser avec **Key Output Gain** (0.7 à 1.0). |
| 04 | PEAU | Qualifier HSL sur la peau → Sat +10 à +15, légèrement vers le rouge/magenta (comme les réfs). |
| 05 | NOIRS | Courbe : descendre le point bas, Lift légèrement bleu. Sat 0 dans les basses lumières (Lum vs Sat). |
| 06 | VIGNETTE | Fenêtre circulaire douce, inversée, Gain -0.10. |
| 07 | ABERRATION | Splitter/Combiner (voir ci-dessous). |
| 08 | GRAIN | Studio : ResolveFX **Film Grain** (35mm, opacité ~0.3). Version gratuite : overlay de grain en mode Overlay sur la timeline. |

### Aberration chromatique (franges rouges des réfs)
Clic droit sur le nœud 07 > **Add Splitter/Combiner Node** → 3 nœuds R/G/B.
Sur le nœud **R** : Sizing (Node Sizing) → Zoom 1.003 ou Pan +2 px. Sur le **B** : Zoom 0.997 ou Pan -2 px.

### Ghosting / traînées (optionnel)
Studio : ResolveFX **Motion Trails** (ou **Motion Blur**) sur un nœud à part, uniquement sur les plans qui bougent.

## Version rapide (1 nœud)
Un seul nœud avec `fp9_nuit_froide_slog2.cube`. Corriger l'expo/WB **dans un nœud avant**, jamais après.

## Conseils PP7
- L'A7R IV enregistre en 8 bits : ne pas pousser le grade trop fort (banding).
- S-Log2 bien exposé = +1 à +1.7 IL. Rush sous-exposé → monter l'Offset au nœud 01, sinon bruit dans les noirs.
- Pour les plans nuit, c'est OK de laisser le sujet sombre : le look vit des noirs écrasés.
