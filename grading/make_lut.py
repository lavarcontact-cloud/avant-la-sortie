"""Génère les LUT 'nuit froide' (style clip FP9 - Jsuis Messi).
Look : désaturé, noirs écrasés, ombres bleu acier, hautes lumières blanc froid,
rouges/peaux légèrement conservés (teinte rosée).

Usage :
  python3 make_lut.py                 -> fp9_nuit_froide.cube        (entrée Rec.709, à mettre APRÈS un CST)
  python3 make_lut.py slog2           -> fp9_nuit_froide_slog2.cube  (entrée Sony S-Gamut/S-Log2 = PP7, tout-en-un)

Variables d'environnement (optionnelles) :
  MAG=0                 retire le magenta des médiums (v2, pour les rushs déjà magenta)
  WB_R/WB_G/WB_B=1.0    gains de balance des blancs en linéaire, appliqués avant le look (mode slog2)
  BLUE=1.0              dose du bleu acier dans les ombres (0 = noirs neutres comme la réf)
  SAT=1.0               multiplicateur de saturation du look
  BP/WP/GAMMA           courbe "réf FP9" sur la luma : noir écrasé à BP, blanc à WP, gamma (off par défaut)
  OUT=fichier.cube      nom du fichier de sortie
  ex. v2 C2802 : WB_R=0.85 WB_G=1.45 WB_B=1.1 MAG=0 OUT=fp9_nuit_froide_slog2_v2_C2802.cube python3 make_lut.py slog2
  ex. v3 C2802 (calé sur la réf TikTok FP9 - Jsuis Messi) :
      WB_R=0.85 WB_G=1.45 WB_B=1.1 MAG=1 BLUE=0.15 SAT=1.6 BP=0.08 WP=0.42 GAMMA=2.2       OUT=fp9_nuit_froide_slog2_v3_C2802.cube python3 make_lut.py slog2
"""
import numpy as np, sys

mode = sys.argv[1] if len(sys.argv) > 1 else "rec709"
import os
MAG = float(os.environ.get("MAG", "1.0"))      # dose du magenta médiums (0 = v2, sans dominante rosée)
WB_R = float(os.environ.get("WB_R", "1.0"))    # gains de balance des blancs en linéaire, avant le look
WB_G = float(os.environ.get("WB_G", "1.0"))    # (vert > 1 corrige un rush magenta)
WB_B = float(os.environ.get("WB_B", "1.0"))
OUT = os.environ.get("OUT")
BLUE = float(os.environ.get("BLUE", "1.0"))    # dose du bleu acier dans les ombres (0 = noirs neutres)
SAT = float(os.environ.get("SAT", "1.0"))      # multiplicateur de saturation du look
# Courbe "réf FP9" (désactivée par défaut) : noir écrasé à BP, blanc à WP, gamma GAMMA, épaule douce
BP = float(os.environ.get("BP", "0")); WP = float(os.environ.get("WP", "1")); GAMMA = float(os.environ.get("GAMMA", "1"))
N = 65 if mode == "slog2" else 33
out = OUT or ("fp9_nuit_froide_slog2.cube" if mode == "slog2" else "fp9_nuit_froide.cube")
LUMA = np.array([0.2126, 0.7152, 0.0722])


def smooth(x, a, c):
    t = np.clip((x - a) / (c - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------- Conversion Sony S-Gamut / S-Log2 -> Rec.709 (gamma 2.4) ----------
def slog2_decode(v):
    """Code value normalisé (0-1, niveaux data) -> linéaire scène (0.18 = gris moyen)."""
    x = (v * 1023 - 64) / 876  # legal -> full
    lin = np.where(
        x >= 0.030001222851889303,
        10 ** ((x - 0.616596 - 0.03) / 0.432699) - 0.037584,
        (x - 0.030001222851889303) / 5.0,
    )
    return 219 * lin * 0.9 / 155


def rgb_to_xyz(prims, white=(0.3127, 0.3290)):
    def xyz(xy):
        return np.array([xy[0] / xy[1], 1, (1 - xy[0] - xy[1]) / xy[1]])
    P = np.stack([xyz(p) for p in prims], 1)
    S = np.linalg.solve(P, xyz(white))
    return P * S


SGAMUT = rgb_to_xyz([(0.730, 0.280), (0.140, 0.855), (0.100, -0.050)])
REC709 = rgb_to_xyz([(0.640, 0.330), (0.300, 0.600), (0.150, 0.060)])
SGAMUT_TO_709 = np.linalg.inv(REC709) @ SGAMUT


def slog2_to_rec709(rgb):
    lin = slog2_decode(rgb) @ SGAMUT_TO_709.T
    lin = lin * np.array([WB_R, WB_G, WB_B])
    # compression douce des couleurs hors gamut 709 (évite les aplats fluo)
    Y = np.maximum(lin @ LUMA, 0)[:, None]
    lin = Y + (lin - Y) * 0.92
    lin = np.maximum(lin, 0)
    # tone mapping filmique (épaule douce, blanc ~4 stops au-dessus du gris)
    x = 1.2 * lin
    d = x * (1 + x / 16) / (1 + x)
    return np.clip(d, 0, 1) ** (1 / 2.4)


# ---------- Le look FP9 (entrée Rec.709) ----------
def look(rgb):
    # 1) Exposition un peu baissée
    x = rgb * 0.92

    # 2) Saturation sélective : on garde un peu les rouges/peaux, le reste part au gris
    Y = x @ LUMA
    mx, mn = x.max(1), x.min(1)
    redness = np.clip((x[:, 0] - np.maximum(x[:, 1], x[:, 2])) / (mx - mn + 1e-6), 0, 1)
    sat = (0.32 + 0.28 * redness) * SAT
    x = Y[:, None] + (x - Y[:, None]) * sat[:, None]

    # 3) Courbe de contraste : noirs écrasés, épaule douce en haut
    v = np.clip((x - 0.035) / 0.965, 0, 1)
    s = v + 0.22 * (smooth(v, 0, 1) - v) * 1.6
    x = np.clip(0.005 + s * 0.93, 0, 1)

    # 4) Split toning : ombres bleu acier, hautes lumières blanc légèrement cyan
    L = x @ LUMA
    x = x + (1 - smooth(L, 0.0, 0.45))[:, None] * np.array([-0.025, 0.000, 0.045]) * BLUE
    x = x + smooth(L, 0.55, 1.0)[:, None] * np.array([-0.015, 0.005, 0.020])
    # léger magenta dans les médiums (peau rosée des réfs)
    x = x + np.clip(1 - np.abs(L - 0.4) / 0.4, 0, 1)[:, None] * np.array([0.012, -0.010, 0.010]) * MAG
    x = np.clip(x, 0, 1)

    # 5) Courbe réf FP9 : appliquée sur la luma, teinte conservée (ratio RGB / luma)
    if (BP, WP, GAMMA) != (0, 1, 1):
        L = np.maximum(x @ LUMA, 1e-6)
        v = np.clip((L - BP) / (WP - BP), 0, None) ** GAMMA
        knee = 0.85
        v = np.where(v > knee, knee + (1 - knee) * np.tanh((v - knee) / (1 - knee)), v)
        x = x * (v / L)[:, None]
        # au-delà du blanc, on désature vers le blanc au lieu d'écrêter la teinte
        over = np.clip(x.max(1) - 1, 0, None)[:, None]
        x = np.clip(x + over, 0, 1)
    return x


if __name__ == "__main__":
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # .cube : R varie le plus vite
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    if mode == "slog2":
        rgb = slog2_to_rec709(rgb)
    res = look(rgb)
    title = "FP9 Nuit Froide (S-Log2 in)" if mode == "slog2" else "FP9 Nuit Froide"
    with open(out, "w") as f:
        f.write('TITLE "%s"\nLUT_3D_SIZE %d\n\n' % (title, N))
        for v in res:
            f.write("%.6f %.6f %.6f\n" % tuple(v))
    print("LUT écrit :", out)
