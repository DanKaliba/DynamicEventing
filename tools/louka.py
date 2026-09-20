"""Vygeneruje SVG louku pro hero svatebního webu.

Ručně rozmístit sto stonků by dopadlo pravidelně — a louka pravidelná
není. Generátor je deterministický (pevný seed), takže výstup je pokaždé
stejný; přegenerovat po zásahu je otázka vteřiny.

Tři vrstvy kvůli hloubce:
  1. zadní    — menší, tmavší a hustší květy
  2. podrost  — souvislá zubatá masa trávy dole, drží spodní hranu
  3. přední   — větší a syté, nesou barvu

Hlavičky květů jdou do <defs> a používají se přes <use>. Bez toho má
soubor přes 150 kB; takhle je pod 40 a rozmanitost zůstává, protože
variant je od každého druhu několik a každé užití má vlastní otočení.

Barvy jsou navzorkované z fotky louky (viz palette.py), ne odhadnuté.
"""

import math
import random

random.seed(20270612)  # datum svatby, ať je seed na něco

W, H = 1200, 320

MAK = "#CC030E"
MAK_STRED = "#2A0A08"
CHRPA = "#2E6BD8"       # oproti vzorku zesvětleno — #175ACA na tmavé zeleni zaniká
PRYSKYRNIK = "#E3C93A"  # taky zesvětleno, aby nešlo do olivova
KOPRETINA = "#ECEEE7"
SILENKA = "#C96EA6"
TRAVA = "#99B949"
TRAVA_TMAVA = "#496E16"
LES = "#0C1A06"


def mix(hexa, s_cim, podil):
    hexa, s_cim = hexa.lstrip("#"), s_cim.lstrip("#")
    out = []
    for i in (0, 2, 4):
        a, b = int(hexa[i:i + 2], 16), int(s_cim[i:i + 2], 16)
        out.append(int(round(a * (1 - podil) + b * podil)))
    return "#{:02X}{:02X}{:02X}".format(*out)


def do_dalky(barva, podil):
    """Barva viděná hlouběji v louce.

    Čisté míchání s barvou lesa ubíjí žlutou do bahna, protože jí bere
    světlost rychleji než sytost. Proto se nejdřív část cesty jde k trávě
    a teprve zbytek ke tmě.
    """
    return mix(mix(barva, TRAVA, podil * 0.35), LES, podil * 0.55)


def kruh(cx, cy, r, fill):
    return f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.1f}" fill="{fill}"/>'


def elipsa(cx, cy, rx, ry, fill, uhel=0):
    t = f' transform="rotate({uhel:.0f} {cx:.0f} {cy:.0f})"' if uhel else ""
    return f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}"{t}/>'


# ---------- Hlavičky květů, se středem v (0,0) ----------

def mak(barva):
    """Vlčí mák — čtyři široké překryté lístky, tmavý střed."""
    kusy = []
    for i in range(4):
        uhel = i * 90 + random.uniform(-20, 20)
        r = random.uniform(11, 15)
        vzd = random.uniform(4, 7)
        kusy.append(elipsa(
            vzd * (1 if i in (0, 3) else -1),
            vzd * (1 if i < 2 else -1),
            r, r * random.uniform(0.72, 0.92), barva, uhel))
    kusy.append(kruh(0, 0, 3.6, mix(MAK_STRED, barva, 0.25)))
    return "".join(kusy)


def chrpa(barva):
    """Chrpa — roztřepaná hvězdice; lístky musí být dost dlouhé, aby se četla."""
    kusy = []
    for i in range(8):
        uhel = i * 45 + random.uniform(-12, 12)
        d = random.uniform(10, 14)
        kusy.append(elipsa(0, -d / 1.5, 3.4, d / 1.5, barva, uhel))
    kusy.append(kruh(0, 0, 3.4, mix(barva, LES, 0.4)))
    return "".join(kusy)


def pryskyrnik(barva):
    """Pryskyřník — pět kulatých lístků."""
    kusy = []
    for i in range(5):
        rad = math.radians(i * 72 + random.uniform(-10, 10))
        d = 5.8
        kusy.append(kruh(d * math.cos(rad), d * math.sin(rad), 5.4, barva))
    kusy.append(kruh(0, 0, 2.6, mix(barva, "#8A6A10", 0.6)))
    return "".join(kusy)


def kopretina(barva):
    """Kopretina — věnec lístků se žlutým středem."""
    kusy = []
    for i in range(12):
        uhel = i * 30 + random.uniform(-7, 7)
        kusy.append(elipsa(0, -9.5, 2.7, 8.0, barva, uhel))
    kusy.append(kruh(0, 0, 4.3, PRYSKYRNIK))
    return "".join(kusy)


def silenka(barva):
    """Silenka — pět drobných lístků, nejmenší květ louky."""
    kusy = []
    for i in range(5):
        uhel = i * 72 + random.uniform(-12, 12)
        rad = math.radians(uhel)
        kusy.append(elipsa(4.4 * math.cos(rad), 4.4 * math.sin(rad), 4.0, 2.8, barva, uhel))
    kusy.append(kruh(0, 0, 1.8, mix(barva, LES, 0.4)))
    return "".join(kusy)


def poupe(barva):
    return elipsa(0, 0, 3.4, 6.0, barva)


# Poslední číslo je váha — jak často druh v louce padne. Zhruba podle fotky.
DRUHY = {
    "mak": (mak, MAK, 10),
    "pryskyrnik": (pryskyrnik, PRYSKYRNIK, 8),
    "kopretina": (kopretina, KOPRETINA, 9),
    "chrpa": (chrpa, CHRPA, 5),
    "silenka": (silenka, SILENKA, 2),
    "poupe": (poupe, TRAVA_TMAVA, 4),
}

# Dvě hloubky: 0 = přední, syté; 1 = zadní, utlumené do dálky.
HLOUBKY = [0.0, 0.5]
VARIANT = 5

defs = []
ids = {}
for nazev, (kresba, zakladni, _) in DRUHY.items():
    for h_i, h in enumerate(HLOUBKY):
        klice = []
        for v in range(VARIANT):
            ident = f"{nazev[:2]}{h_i}{v}"
            defs.append(f'<g id="{ident}">{kresba(do_dalky(zakladni, h))}</g>')
            klice.append(ident)
        ids[(nazev, h_i)] = klice

VAHY = [nazev for nazev, (_, _, v) in DRUHY.items() for _ in range(v)]


def podrost():
    """Souvislá zubatá masa trávy u spodní hrany.

    Jeden vyplněný tvar místo stovky stébel — drží spodek kompozice
    a stojí pár set bajtů. Tři vrstvy pro hloubku.
    """
    kusy = []
    for zaklad, rozptyl, barva in [
        (52, 30, do_dalky(TRAVA_TMAVA, 0.55)),
        (34, 26, do_dalky(TRAVA_TMAVA, 0.25)),
        (20, 18, TRAVA_TMAVA),
    ]:
        body = [f"M -10,{H}"]
        x = -10.0
        while x < W + 10:
            krok = random.uniform(7, 26)
            # Většina stébel drží úroveň, každé páté vystřelí nad ni. Bez toho
            # je z toho pilové ostří místo trávy.
            vyska = zaklad + random.uniform(0, rozptyl)
            if random.random() < 0.2:
                vyska += random.uniform(rozptyl, rozptyl * 2.4)
            vrchol = H - vyska
            # Stéblo se ohýbá, takže špička nesedí nad středem základny.
            spicka = x + krok * random.uniform(0.25, 0.75)
            body.append(
                f"Q {x + krok * 0.3:.0f},{vrchol + vyska * 0.35:.0f} "
                f"{spicka:.0f},{vrchol:.0f} "
                f"Q {x + krok * 0.7:.0f},{vrchol + vyska * 0.4:.0f} "
                f"{x + krok:.0f},{H}")
            x += krok
        body.append("Z")
        kusy.append(f'<path d="{" ".join(body)}" fill="{barva}"/>')
    return "".join(kusy)


def stonek(x, vyska, meritko, h_i):
    """Jeden stonek s květem, připravený k animaci růstu."""
    nazev = random.choice(VAHY)
    ident = random.choice(ids[(nazev, h_i)])

    barva_stonku = do_dalky(
        random.choice([TRAVA, TRAVA, TRAVA_TMAVA]), HLOUBKY[h_i] + 0.15)
    ohyb = random.uniform(-30, 30)
    sirka = max(1.0, 2.0 * meritko)

    stvol = (f'<path d="M 0,0 Q {ohyb:.0f},{-vyska * 0.6:.0f} '
             f'{ohyb * 1.5:.0f},{-vyska:.0f}" stroke="{barva_stonku}" '
             f'stroke-width="{sirka:.1f}" fill="none" stroke-linecap="round"/>')

    otoceni = random.uniform(-25, 25)
    hlava = (f'<use href="#{ident}" transform="translate({ohyb * 1.5:.0f},{-vyska:.0f}) '
             f'rotate({otoceni:.0f}) scale({meritko:.2f})"/>')

    # Zpoždění roste zleva doprava — louka se rozjede jako vlna.
    zpozdeni = (x / W) * 0.5 + random.uniform(0, 0.22)
    return (f'<g transform="translate({x:.0f},{H})">'
            f'<g class="stonek" style="--d:{zpozdeni:.2f}s">{stvol}{hlava}</g></g>')


def vrstva(pocet, rozsah_vysky, rozsah_meritka, h_i, trida):
    kusy = []
    for i in range(pocet):
        # Rovnoměrné rozdělení s rozptylem — ne mřížka, ale ani shluky.
        x = (i + random.uniform(-0.5, 0.5)) * (W / pocet)
        kusy.append(stonek(
            max(-25, min(W + 25, x)),
            random.uniform(*rozsah_vysky),
            random.uniform(*rozsah_meritka), h_i))
    return f'<g class="{trida}">' + "".join(kusy) + "</g>"


svg = (
    f'<svg class="louka" viewBox="0 0 {W} {H}" '
    f'preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">'
    f'<defs>{"".join(defs)}</defs>'
    + vrstva(70, (70, 175), (0.5, 0.8), 1, "vrstva-zadni")
    + podrost()
    + vrstva(42, (120, 280), (0.85, 1.3), 0, "vrstva-predni")
    + "</svg>"
)

print(svg)
