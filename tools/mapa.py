"""Vygeneruje malou mapku okolí Himmelreichu s možnostmi ubytování.

Souřadnice jsou reálné GPS body (viz BODY níž), promítnuté jednoduchou
rovnoběžkovou projekcí (v tak malém měřítku — necelý kilometr napříč —
je zkreslení oproti pořádné kartografické projekci zanedbatelné).
Himmelreich je počátek souřadnic mapy, ne nutně střed plátna.

Plné kolečko = střecha nad hlavou (chalupa, hotel, kemp).
Prázdné kolečko = bivak — spací pytel a nebe nad hlavou, žádná budova.
Rozdíl mezi plným a prázdným kolečkem tedy nese skutečnou informaci,
není to jen ozdoba.

Plátno se počítá z reálného rozpětí bodů, ne z pevného čísla — jinak
se při přidání vzdálenějšího bodu (třeba dalšího bivaku) okraj mapy
tiše usekne, přesně jak se stalo napoprvé se Sovou.

Spustit samostatně vypíše i vzdálenosti od Himmelreichu v metrech — pro
psaní textu v index.html, ne pro vkládání do stránky.
"""

import io
import math
import sys

# (jméno, lat, lon, kategorie)
# kategorie: "domov" | "hotel" | "kemp" | "bivak"
BODY = [
    ("Himmelreich",       50.8019203, 14.0456936, "domov"),
    ("Hotel Ostrov",      50.8039125, 14.0463156, "hotel"),
    ("Kemp Pod Císařem",  50.8026650, 14.0464550, "kemp"),
    ("Německý bivak",     50.8007189, 14.0375797, "bivak"),
    ("Sova",              50.7949447, 14.0439311, "bivak"),
    ("Lesní jesličky",    50.7997819, 14.0509311, "bivak"),
]

STRED = (50.8019203, 14.0456936)  # Himmelreich — vztažný bod pro vzdálenosti

# Barvy jsou buď CSS proměnné (přizpůsobí se motivu automaticky), nebo
# pevný hex tam, kde žádná vhodná proměnná v paletě není — u toho je pak
# vybraná hodnota, co obstojí v obou motivech (viz komentář u KEMP_HEX).
BARVA = {
    "domov": "var(--mak)",    # mak — stejná barva jako favicon a odkazy
    "hotel": "var(--chrpa)",  # chrpa má už hotovou tmavou variantu v paletě
}
# "kemp" má vlastní proměnnou --kemp v style.css (var(--pryskyrnik) by
# nešlo — ta barva má na světlém pozadí kontrast jen 1.75:1, viz README).
# Hodnota #8F740C tam je vybraná tak, aby jako plocha (≥3:1, ne plný
# text) obstála v obou motivech zároveň: 4.09 na světlém, 4.01 na tmavém.

# Ruční doladění popisků tam, kde by automatika (label nad bodem,
# zarovnání podle blízkosti okraje) dvě jména slepila k sobě — hlavně
# Himmelreich a Kemp Pod Císařem, které jsou od sebe jen 99 m.
# {jméno: (dx, dy, zarovnání)}
POPISEK_PREPIS = {
    "Himmelreich":      (0, 20, "middle"),
    "Kemp Pod Císařem": (10, -12, "start"),
    "Hotel Ostrov":     (0, 20, "middle"),
    "Lesní jesličky":   (-8, -12, "end"),
}

MERITKO = 0.42  # px na metr
LEVY_OKRAJ, PRAVY_OKRAJ = 110, 120
HORNI_OKRAJ, DOLNI_OKRAJ = 78, 130


def do_metru(bod, stred):
    """Rovnoběžková projekce: dost přesná na necelý kilometr.

    Kladné x = východ, kladné y = sever (jako na běžné mapě).
    """
    lat, lon = bod
    lat0, lon0 = stred
    km_na_stupen_lat = 111.32
    km_na_stupen_lon = 111.32 * math.cos(math.radians(lat0))
    x = (lon - lon0) * km_na_stupen_lon * 1000
    y = (lat - lat0) * km_na_stupen_lat * 1000
    return x, y


def vzdalenost_m(bod, stred):
    x, y = do_metru(bod, stred)
    return math.hypot(x, y)


def vygeneruj_svg():
    """Vrátí hotové <svg>…</svg> jako řetězec, připravené k vložení do HTML.

    Používá var(--text) apod. — proto musí být vložené inline ve stránce,
    ne jako <img src=…>, jinak by si vlastní CSS proměnné stránky nevzalo.
    """
    body_m = [(jmeno, kat, *do_metru((lat, lon), STRED)) for jmeno, lat, lon, kat in BODY]

    min_x = min(x for _, _, x, _ in body_m)
    max_x = max(x for _, _, x, _ in body_m)
    min_y = min(y for _, _, _, y in body_m)
    max_y = max(y for _, _, _, y in body_m)

    W = LEVY_OKRAJ + (max_x - min_x) * MERITKO + PRAVY_OKRAJ
    H = HORNI_OKRAJ + (max_y - min_y) * MERITKO + DOLNI_OKRAJ

    def px(x, y):
        # Sever nahoře: čím větší y (severněji), tím menší souřadnice na plátně.
        return (LEVY_OKRAJ + (x - min_x) * MERITKO,
                HORNI_OKRAJ + (max_y - y) * MERITKO)

    pozice = {jmeno: px(x, y) for jmeno, kat, x, y in body_m}

    kusy = []
    for jmeno, kat, x, y in body_m:
        cx, cy = pozice[jmeno]

        if kat == "bivak":
            # Prázdné kolečko — spí se venku, žádná střecha.
            kusy.append(
                f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5" fill="var(--pozadi)" '
                f'stroke="var(--text-tlumeny)" stroke-width="1.5"/>')
            barva_popisku = "var(--text-tlumeny)"
            tucne = ""
        else:
            barva = "var(--kemp)" if kat == "kemp" else BARVA[kat]
            r = 7 if kat == "domov" else 5.5
            kusy.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{barva}"/>')
            # Popisek "kemp" barvou dotu by na tmavém pozadí ještě fungoval,
            # ale je čitelnější plnou barvou textu jako zbytek stránky.
            # "domov" jde přes var(--odkaz) — var(--mak) sama o sobě má na
            # tmavém pozadí jako TEXT jen 3.08:1 (na plochu dotu to stačí,
            # na písmo ne), var(--odkaz) je pro to už v paletě připravená.
            if kat == "domov":
                barva_popisku = "var(--odkaz)"
            elif kat == "kemp":
                barva_popisku = "var(--text)"
            else:
                barva_popisku = barva
            tucne = ' font-weight="600"' if kat == "domov" else ""

        if jmeno in POPISEK_PREPIS:
            dx, dy, kotva = POPISEK_PREPIS[jmeno]
        else:
            dy = -14 if cy > HORNI_OKRAJ * 1.3 else 20
            if cx < LEVY_OKRAJ * 1.1:
                kotva, dx = "start", 8
            elif cx > W - PRAVY_OKRAJ * 1.1:
                kotva, dx = "end", -8
            else:
                kotva, dx = "middle", 0

        kusy.append(
            f'<text x="{cx + dx:.1f}" y="{cy + dy:.1f}" text-anchor="{kotva}" '
            f'font-family="var(--display)" font-size="15"{tucne} '
            f'fill="{barva_popisku}">{jmeno}</text>')

    # Měřítko a severka — spolu v dolním pruhu, mimo shluk bodů.
    delka_200m = 200 * MERITKO
    sx, sy = LEVY_OKRAJ, H - DOLNI_OKRAJ * 0.42
    meritko_svg = (
        f'<g font-family="var(--text-font)" font-size="12" fill="var(--text-tlumeny)">'
        f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{sx + delka_200m:.1f}" y2="{sy:.1f}" '
        f'stroke="var(--text-tlumeny)" stroke-width="1.5"/>'
        f'<line x1="{sx:.1f}" y1="{sy - 4:.1f}" x2="{sx:.1f}" y2="{sy + 4:.1f}" '
        f'stroke="var(--text-tlumeny)"/>'
        f'<line x1="{sx + delka_200m:.1f}" y1="{sy - 4:.1f}" '
        f'x2="{sx + delka_200m:.1f}" y2="{sy + 4:.1f}" stroke="var(--text-tlumeny)"/>'
        f'<text x="{sx + delka_200m / 2:.1f}" y="{sy - 8:.1f}" text-anchor="middle">'
        f'200 m</text></g>')

    nx, ny = W - PRAVY_OKRAJ * 0.55, H - DOLNI_OKRAJ * 0.42
    severka = (
        f'<g stroke="var(--text-tlumeny)" fill="none" stroke-width="1.5" '
        f'stroke-linecap="round" stroke-linejoin="round">'
        f'<line x1="{nx:.1f}" y1="{ny:.1f}" x2="{nx:.1f}" y2="{ny - 24:.1f}"/>'
        f'<path d="M {nx - 4:.1f},{ny - 18:.1f} L {nx:.1f},{ny - 26:.1f} '
        f'L {nx + 4:.1f},{ny - 18:.1f}"/></g>'
        f'<text x="{nx:.1f}" y="{ny - 30:.1f}" text-anchor="middle" '
        f'font-family="var(--text-font)" font-size="12" font-weight="600" '
        f'fill="var(--text-tlumeny)">S</text>')

    svg = (
        f'<svg class="mapka" viewBox="0 0 {W:.0f} {H:.0f}" role="img" '
        f'aria-label="Mapka okolí chalupy Himmelreich s možnostmi ubytování">'
        f'{"".join(kusy)}{meritko_svg}{severka}</svg>')
    return svg


if __name__ == "__main__":
    print("Vzdálenosti od Himmelreichu (vzdušnou čarou):")
    for jmeno, lat, lon, kat in BODY:
        if jmeno == "Himmelreich":
            continue
        d = vzdalenost_m((lat, lon), STRED)
        print(f"  {jmeno:<20} {d:5.0f} m   ({kat})")

    svg = vygeneruj_svg()
    if len(sys.argv) > 1:
        io.open(sys.argv[1], "w", encoding="utf-8").write(svg)
        print(f"\nzapsáno do {sys.argv[1]}, {len(svg)} znaků")
    else:
        print(f"\nSVG: {len(svg)} znaků (bez cílového souboru se jen vypsaly vzdálenosti)")
