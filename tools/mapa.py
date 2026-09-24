"""Vygeneruje malou mapku okolí Himmelreichu s možnostmi ubytování.

Souřadnice bodů (viz BODY níž) jsou reálné GPS, promítnuté jednoduchou
rovnoběžkovou projekcí (v tak malém měřítku — necelý kilometr napříč —
je zkreslení oproti pořádné kartografické projekci zanedbatelné).
Himmelreich je počátek souřadnic mapy, ne nutně střed plátna.

Terén (TEREN níž — rybník, silnice, lesní zóna) naproti tomu přesné
souřadnice NEMÁ. Je odhadnutý podle poměrů na screenshotech z Mapy.cz
(poloha rybníku u Hotelu Ostrov, trasa silnice osadou, značené stezky
směrem ke skalám) — dost přesně na to, aby mapa přestala být prázdný
čtverec s tečkami, ne dost přesně na navigaci. Cesty ke třem bivakům
jsou stylizované (jemně zvlněná křivka od osady k cíli), ne trasované
GPS stopy — skutečné cesty lesem vedou jinudy a klikatěji.

Plné kolečko = střecha nad hlavou (chalupa, hotel, kemp).
Prázdné kolečko = bivak — spací pytel a nebe nad hlavou, žádná budova.
Rozdíl mezi plným a prázdným kolečkem tedy nese skutečnou informaci,
není to jen ozdoba.

Plátno se počítá z reálného rozpětí bodů BODY, ne z pevného čísla —
jinak se při přidání vzdálenějšího bodu (třeba dalšího bivaku) okraj
mapy tiše usekne, přesně jak se stalo napoprvé se Sovou. Terén se do
téhle úvahy nepočítá (je autorsky umístěný tak, aby se do okrajů vešel)
a mimo plátno se prostě neprokreslí — SVG ho ořízne samo.

Spustit samostatně vypíše i vzdálenosti od Himmelreichu v metrech — pro
psaní textu v index.html, ne pro vkládání do stránky.
"""

import io
import math
import random
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
# vybraná hodnota, co obstojí v obou motivech (viz komentář u --kemp
# v style.css).
BARVA = {
    "domov": "var(--mak)",    # mak — stejná barva jako favicon a odkazy
    "hotel": "var(--chrpa)",  # chrpa má už hotovou tmavou variantu v paletě
}

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

# ---------------------------------------------------------------------------
# Terén — odhadnutý, ne GPS. Souřadnice v metrech od Himmelreichu, stejná
# soustava jako BODY (kladné x = východ, kladné y = sever).
# ---------------------------------------------------------------------------

# Silnice osadou: od jihu k severu kolem shluku Himmelreich/Kemp/Hotel,
# mírně na východ od Himmelreichu (podle screenshotu 1, kde silnice
# odděluje chalupu od rybníku). Vede za okraje plátna, ať je jasné,
# že pokračuje dál.
SILNICE = [(15, -650), (22, -300), (28, -20), (34, 90), (42, 210), (52, 480)]

# Rybník (Ostrovský rybník / PP Eiland) — hned u Hotelu Ostrov, podle
# screenshotů 1, 3 a 5. Přibližný tvar, ne vytrasovaný polygon.
RYBNIK_STRED = (72, 275)
RYBNIK_R = (34, 46)

# Lesní/skalní zóna — podle screenshotů hustě zalesněná oblast s
# pískovcovými věžemi, jihozápadně od osady. Pokrývá jen Německý bivak
# a Sovu (oba mají odkaz na horosvaz.cz, jsou to skutečné lezecké věže
# ve skalách); Lesní jesličky leží na opačné, východní straně a do
# stejné skalní oblasti nepatří — proto je zóna elipsa mezi prvními
# dvěma, ne jedna velká plocha přes všechny tři.
LES_STRED = (-347, -455)
LES_R = (300, 340)
LES_POPISEK_POZICE = (-300, -430)

# Odkud vedou stezky k bivakům — zhruba od Kempu, kde se cesty k lesu
# reálně sbíhají (screenshoty 1 a 2).
STEZKA_START = (50, 70)


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


def vyhladit_uzavrenou(body):
    """Uzavřená vyhlazená křivka přes zadané body (už v cílových jednotkách).

    Klasický trik na hladký mnohoúhelník bez počítání tečen: každá hrana
    se nahradí kvadratickou křivkou, jejíž řídicí bod je původní roh a
    koncový bod je střed hrany. Levné na výpočet, dost hladké na to, aby
    rybník nevypadal jako vystřižený z papíru s rovnými hranami.
    """
    stredy = [((body[i][0] + body[(i + 1) % len(body)][0]) / 2,
               (body[i][1] + body[(i + 1) % len(body)][1]) / 2)
              for i in range(len(body))]
    d = [f'M {stredy[-1][0]:.1f},{stredy[-1][1]:.1f}']
    for roh, stred_hrany in zip(body, stredy):
        d.append(f'Q {roh[0]:.1f},{roh[1]:.1f} {stred_hrany[0]:.1f},{stred_hrany[1]:.1f}')
    d.append('Z')
    return ' '.join(d)


def nepravidelny_prstenec(cx, cy, rx, ry, pocet, nepravidelnost, rng):
    """Body rozhozené kolem elipsy — základ pro rybník i lesní zónu."""
    out = []
    for i in range(pocet):
        uhel = 2 * math.pi * i / pocet + rng.uniform(-0.15, 0.15)
        r = 1 + rng.uniform(-nepravidelnost, nepravidelnost)
        out.append((cx + rx * r * math.cos(uhel), cy + ry * r * math.sin(uhel)))
    return out


def vygeneruj_svg():
    """Vrátí hotové <svg>…</svg> jako řetězec, připravené k vložení do HTML.

    Používá var(--text) apod. — proto musí být vložené inline ve stránce,
    ne jako <img src=…>, jinak by si vlastní CSS proměnné stránky nevzalo.
    """
    rng = random.Random(1808)  # pevný seed — rybník i les vypadají pokaždé stejně

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

    # ---------- Terén — kreslí se první, ať jsou body a popisky nahoře. ----------

    teren = []

    # Lesní/skalní zóna — tichá, jde pod všechno ostatní.
    les_body = [px(x, y) for x, y in nepravidelny_prstenec(
        *LES_STRED, *LES_R, pocet=10, nepravidelnost=0.3, rng=rng)]
    teren.append(
        f'<path d="{vyhladit_uzavrenou(les_body)}" fill="var(--trava-tmava)" '
        f'fill-opacity="0.13" stroke="none"/>')
    # Bilingvní popisek — bez podkladového obdélníku (sedí jen na tiché
    # ploše zóny), takže se dva překryté <text> prvky dají bezpečně
    # přepínat stejnou třídou jako zbytek stránky (viz .jazyk-cs/.jazyk-en
    # v style.css). Jediné dvě slova v celé mapce, co se překládají —
    # zbytek jsou vlastní jména.
    lx, ly = px(*LES_POPISEK_POZICE)
    for trida, text in (("jazyk-cs", "pískovcové skály"), ("jazyk-en", "sandstone rocks")):
        teren.append(
            f'<text class="{trida}" x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
            f'font-family="var(--text-font)" font-size="12" font-style="italic" '
            f'fill="var(--text-tlumeny)">{text}</text>')

    # Rybník.
    rybnik_body = [px(x, y) for x, y in nepravidelny_prstenec(
        *RYBNIK_STRED, *RYBNIK_R, pocet=9, nepravidelnost=0.22, rng=rng)]
    teren.append(
        f'<path d="{vyhladit_uzavrenou(rybnik_body)}" fill="var(--chrpa)" '
        f'fill-opacity="0.24" stroke="var(--chrpa)" stroke-opacity="0.35" '
        f'stroke-width="1"/>')

    # Silnice — polyline s kulatými zlomy, vede za okraje plátna.
    silnice_px = [px(x, y) for x, y in SILNICE]
    d = 'M ' + ' L '.join(f'{x:.1f},{y:.1f}' for x, y in silnice_px)
    teren.append(
        f'<path d="{d}" fill="none" stroke="var(--text-tlumeny)" '
        f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
        f'stroke-opacity="0.55"/>')

    # Stezky ke třem bivakům — jemně prohnutá čára, ne přímka. Řídicí bod
    # se posouvá VODOROVNĚ, ne kolmo na spojnici — kolmý posun měl
    # náhodnou stranu a u Sovy náhodou vyšel směrem k silnici, takže se
    # stezka s ní na kus cesty táhla souběžně a splývala s ní. Vodorovný
    # posun na stranu, kde cíl skutečně leží (na západ pro oba bivaky
    # v lese, na východ pro Lesní jesličky), stezku spolehlivě odkloní
    # pryč od silnice hned od začátku.
    start_px = px(*STEZKA_START)
    for jmeno, kat, x, y in body_m:
        if kat != "bivak":
            continue
        cil_px = px(x, y)
        sx, sy = start_px
        cxp, cyp = cil_px
        stred_x, stred_y = (sx + cxp) / 2, (sy + cyp) / 2
        strana = -1 if x < STEZKA_START[0] else 1  # metry: záporné x = západ
        posun = rng.uniform(28, 55) * strana
        rx = stred_x + posun
        ry = stred_y + rng.uniform(-15, 15)
        teren.append(
            f'<path d="M {sx:.1f},{sy:.1f} Q {rx:.1f},{ry:.1f} {cxp:.1f},{cyp:.1f}" '
            f'fill="none" stroke="var(--text-tlumeny)" stroke-width="1.5" '
            f'stroke-dasharray="1 4" stroke-linecap="round" stroke-opacity="0.7"/>')

    # ---------- Body ubytování a jejich popisky. ----------

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

        # Bílý (pozadí-barevný) podklad za popiskem, ať je čitelný i přes
        # silnici nebo lesní zónu — bez něj by se text s terénem sléval.
        odhad_sirka = len(jmeno) * 8.2
        podklad_x = cx + dx - (odhad_sirka / 2 if kotva == "middle" else
                                (0 if kotva == "start" else odhad_sirka))
        kusy.append(
            f'<rect x="{podklad_x:.1f}" y="{cy + dy - 12:.1f}" width="{odhad_sirka:.0f}" '
            f'height="17" fill="var(--pozadi)" fill-opacity="0.82"/>')

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

    # Jen šipka, bez písmene. "S" (sever) by anglicky čtenář přečetl jako
    # "South" — přesný opak. Psát dvojjazyčně "S/N" je zbytečné, šipka
    # nahoru je bez popisku jednoznačná i tak (mapy takhle sever značí
    # běžně).
    nx, ny = W - PRAVY_OKRAJ * 0.55, H - DOLNI_OKRAJ * 0.42
    severka = (
        f'<g stroke="var(--text-tlumeny)" fill="none" stroke-width="1.5" '
        f'stroke-linecap="round" stroke-linejoin="round">'
        f'<line x1="{nx:.1f}" y1="{ny:.1f}" x2="{nx:.1f}" y2="{ny - 24:.1f}"/>'
        f'<path d="M {nx - 4:.1f},{ny - 18:.1f} L {nx:.1f},{ny - 26:.1f} '
        f'L {nx + 4:.1f},{ny - 18:.1f}"/></g>')

    svg = (
        f'<svg class="mapka" viewBox="0 0 {W:.0f} {H:.0f}" role="img" '
        f'aria-label="Mapka okolí chalupy Himmelreich s možnostmi ubytování">'
        f'{"".join(teren)}{"".join(kusy)}{meritko_svg}{severka}</svg>')
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
