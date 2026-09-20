"""Vytáhne paletu z fotky louky.

Prosté k-means by utopilo květy v zeleni (tráva je 80 % plochy), takže
místo toho vybírám pásma odstínu a v každém beru medián dostatečně
sytých pixelů. Medián, ne průměr — průměr míchá sousední odstíny do šedi.
"""

import colorsys
import sys

import numpy as np
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert("RGB")
img.thumbnail((800, 800))
rgb = np.asarray(img, dtype=np.float32) / 255.0

h, w, _ = rgb.shape
flat = rgb.reshape(-1, 3)

# HSV po pixelech; vektorizovaně, colorsys neumí pole.
mx = flat.max(axis=1)
mn = flat.min(axis=1)
diff = mx - mn

hue = np.zeros_like(mx)
nz = diff > 1e-6
r, g, b = flat[:, 0], flat[:, 1], flat[:, 2]
idx = nz & (mx == r)
hue[idx] = (60 * ((g[idx] - b[idx]) / diff[idx])) % 360
idx = nz & (mx == g)
hue[idx] = 60 * ((b[idx] - r[idx]) / diff[idx]) + 120
idx = nz & (mx == b)
hue[idx] = 60 * ((r[idx] - g[idx]) / diff[idx]) + 240

sat = np.where(mx > 1e-6, diff / np.maximum(mx, 1e-6), 0)
val = mx


def hexa(c):
    return "#{:02X}{:02X}{:02X}".format(*(int(round(x * 255)) for x in c))


def pick(mask, label):
    """Medián pixelů v masce. Vrací None, když je vzorek moc malý."""
    sel = flat[mask]
    if len(sel) < 40:
        return None
    med = np.median(sel, axis=0)
    hh, ll, ss = colorsys.rgb_to_hls(*med)
    return (label, hexa(med), len(sel), round(hh * 360), round(ll * 100), round(ss * 100))


bands = [
    # popis,            maska
    ("les (tmavá zeleň)", (val < 0.30) & (hue > 60) & (hue < 180)),
    ("tráva světlá",      (hue > 70) & (hue < 110) & (sat > 0.35) & (val > 0.55)),
    ("tráva střední",     (hue > 80) & (hue < 140) & (sat > 0.30) & (val > 0.30) & (val < 0.55)),
    ("vlčí mák",          ((hue < 14) | (hue > 350)) & (sat > 0.55) & (val > 0.35)),
    ("mák ve stínu",      ((hue < 14) | (hue > 350)) & (sat > 0.55) & (val < 0.35)),
    ("pryskyřník",        (hue > 40) & (hue < 62) & (sat > 0.55) & (val > 0.65)),
    ("chrpa",             (hue > 200) & (hue < 255) & (sat > 0.40) & (val > 0.30)),
    ("kopretina (bílá)",  (sat < 0.14) & (val > 0.85)),
    ("růžová silenka",    (hue > 290) & (hue < 345) & (sat > 0.30) & (val > 0.55)),
]

print(f"{'barva':<20} {'hex':<9} {'pixelů':>8}  HSL")
print("-" * 56)
for label, mask in bands:
    got = pick(mask, label)
    if got:
        lbl, hx, n, hh, ll, ss = got
        print(f"{lbl:<20} {hx:<9} {n:>8}  h{hh:>3} s{ss:>3}% l{ll:>3}%")
    else:
        print(f"{label:<20} {'—':<9} {'málo':>8}")

# Celkový průměrný tón fotky — kandidát na podkladovou barvu, hodně zesvětlený.
print("-" * 56)
avg = flat.mean(axis=0)
print(f"{'průměr fotky':<20} {hexa(avg):<9}")
for amt in (0.86, 0.92):
    lifted = avg + (1.0 - avg) * amt
    print(f"{'  zesvětlený ' + str(int(amt * 100)) + '%':<20} {hexa(lifted):<9}")
