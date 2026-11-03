"""Génère le LUT 'nuit froide' (style clip FP9 - Jsuis Messi).
Look : désaturé, noirs écrasés, ombres bleu acier, hautes lumières blanc froid,
rouges/peaux légèrement conservés (teinte rosée)."""
import numpy as np, sys

N = 33
out = sys.argv[1] if len(sys.argv) > 1 else "fp9_nuit_froide.cube"

g = np.linspace(0, 1, N)
b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # .cube : R varie le plus vite
rgb = np.stack([r, gg, b], -1).reshape(-1, 3)

def smooth(x, a, c):
    t = np.clip((x - a) / (c - a), 0, 1)
    return t * t * (3 - 2 * t)

# 1) Exposition un peu baissée
x = rgb * 0.92

# 2) Saturation sélective : on garde un peu les rouges/peaux, le reste part au gris
Y = x @ np.array([0.2126, 0.7152, 0.0722])
mx, mn = x.max(1), x.min(1)
redness = np.clip((x[:, 0] - np.maximum(x[:, 1], x[:, 2])) / (mx - mn + 1e-6), 0, 1)
sat = 0.32 + 0.28 * redness
x = Y[:, None] + (x - Y[:, None]) * sat[:, None]

# 3) Courbe de contraste : noirs écrasés, épaule douce en haut
def curve(v):
    v = np.clip((v - 0.035) / 0.965, 0, 1)            # crush des noirs
    s = v + 0.22 * (smooth(v, 0, 1) - v) * 1.6        # S-curve
    return np.clip(0.005 + s * 0.93, 0, 1)            # blancs plafonnés ~0.93
x = curve(x)

# 4) Split toning : ombres bleu acier, hautes lumières blanc légèrement cyan
L = x @ np.array([0.2126, 0.7152, 0.0722])
w_sh = 1 - smooth(L, 0.0, 0.45)
w_hi = smooth(L, 0.55, 1.0)
x += w_sh[:, None] * np.array([-0.025, 0.000, 0.045])
x += w_hi[:, None] * np.array([-0.015, 0.005, 0.020])
# léger magenta dans les médiums (peau rosée des réfs)
w_mid = 1 - np.abs(L - 0.4) / 0.4
x += np.clip(w_mid, 0, 1)[:, None] * np.array([0.012, -0.010, 0.010])

x = np.clip(x, 0, 1)
with open(out, "w") as f:
    f.write('TITLE "FP9 Nuit Froide"\nLUT_3D_SIZE %d\n\n' % N)
    for v in x:
        f.write("%.6f %.6f %.6f\n" % tuple(v))
print("LUT écrit :", out)
