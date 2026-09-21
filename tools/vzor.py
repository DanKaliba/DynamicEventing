"""Vygeneruje opakovatelnou dlaždici s obrysy rostlin na pozadí stránky.

Stejné rostliny jako v louce, ale místo výplní jen obrysy — jako doodle
pozadí ve WhatsAppu. Protože jsou to vektory, stačí každé cestě vzít
výplň a dát jí místo toho tah; obrysy okvětních lístků a listů se tím
samy odhalí.

Rozmístění je rozostřená mřížka (stejný princip jako u louky v hero):
plocha se rozdělí na buňky a do každé padne jedna rostlina s náhodným
posunem uvnitř buňky. Čistě náhodné rozmístění dělalo shluky — jeden
hustý roh a zbytek prázdný — a to je přesně vidět, protože se dlaždice
opakuje: nápadný shluk by se propsal jako pravidelný vzorek. Mřížka
rozprostře rostliny rovnoměrně, ale rozostření je drží mimo přesné
řady, aby to nepůsobilo jako tabulka.

Dlaždice navazuje: rostlina, která přesahuje přes okraj, se dokreslí
i na protější straně. Bez toho by ve vzoru byly vidět švy.

Výstup je jednobarevný (černý) a v CSS se používá jako maska, ne jako
obrázek — barvu tak určuje stránka a vzor se sám přizpůsobí světlému
i tmavému motivu z jednoho souboru.
"""

import io
import random
import re
import sys

DLAZDICE = 640           # px, velikost opakujícího se čtverce
MRIZKA = 5                # 5×5 buněk = 25 rostlin na dlaždici
VYSKA_MIN, VYSKA_MAX = 34, 58   # menší než v louce — tady je to textura, ne motiv
TLOUSTKA = 0.85           # px, tenčí linka = tišší pozadí

# Výběr z plátu: čitelné siluety, které fungují i jako pouhá linka.
# Husté a spletité druhy (kapradiny, trsy trav) se v obrysu slijí do kaše.
DRUHY = [7, 13, 26, 29, 42, 55, 68, 76, 88, 91, 96, 99, 103, 104, 109]


def na_obrys(telo):
    """Výplně pryč, místo nich tah.

    vector-effect drží tloušťku linky stejnou bez ohledu na to, jak je
    rostlina zvětšená — jinak by malé rostliny měly vlásek a velké provaz.
    """
    telo = re.sub(r'\s*fill="[^"]*"', '', telo)
    telo = re.sub(r'\s*stroke="[^"]*"', '', telo)
    telo = re.sub(r'\s*stroke-width="[^"]*"', '', telo)
    telo = re.sub(r'\s*fill-rule="[^"]*"', '', telo)
    return telo.replace(
        '<path ',
        '<path fill="none" stroke="#000" stroke-width="%s" '
        'vector-effect="non-scaling-stroke" stroke-linecap="round" '
        'stroke-linejoin="round" ' % TLOUSTKA)


def nacti(cesta):
    svg = io.open(cesta, encoding='utf-8').read()
    return dict((i, t) for t, i
                in re.findall(r'(<g id="(k\d{3})".*?</g>)(?=<g id="k|</defs>)', svg, re.S))


def sirky(cesta_json):
    import json
    return dict((r['id'], r['sirka']) for r in json.load(io.open(cesta_json, encoding='utf-8')))


def main(kytky_svg, kytky_json, ven):
    definice = nacti(kytky_svg)
    sirka_pri_100 = sirky(kytky_json)
    rng = random.Random(1619)

    defs = []
    for n in DRUHY:
        ident = 'k%03d' % n
        defs.append(na_obrys(definice[ident]).replace('id="%s"' % ident,
                                                      'id="v%03d"' % n))

    # Pořadí druhů zamíchané, ne po řadě podle plátu — jinak by jedna
    # celá řada mřížky vždycky dostala stejný druh.
    poradi_druhu = DRUHY * ((MRIZKA * MRIZKA // len(DRUHY)) + 1)
    rng.shuffle(poradi_druhu)

    bunka = DLAZDICE / MRIZKA
    kusy = []
    idx = 0
    for radek in range(MRIZKA):
        for sloupec in range(MRIZKA):
            n = poradi_druhu[idx]
            idx += 1

            vyska = rng.uniform(VYSKA_MIN, VYSKA_MAX)
            meritko = vyska / 100.0
            sirka = sirka_pri_100['k%03d' % n] * meritko
            otoceni = rng.uniform(-42, 42)
            zrcadlo = -1 if rng.random() < 0.5 else 1

            # Střed buňky plus rozostření — ne přesná mřížka, ale ani
            # čistý náhodný rozptyl, který dělal shluky.
            x = (sloupec + 0.5) * bunka + rng.uniform(-bunka * 0.32, bunka * 0.32)
            y = (radek + 0.5) * bunka + rng.uniform(-bunka * 0.32, bunka * 0.32)

            vlevo, vpravo = x - sirka / 2, x + sirka / 2
            nahore, dole = y - vyska, y

            posuny_x = [0]
            if vlevo < 0:
                posuny_x.append(DLAZDICE)
            if vpravo > DLAZDICE:
                posuny_x.append(-DLAZDICE)
            posuny_y = [0]
            if nahore < 0:
                posuny_y.append(DLAZDICE)
            if dole > DLAZDICE:
                posuny_y.append(-DLAZDICE)

            for dx in posuny_x:
                for dy in posuny_y:
                    kusy.append(
                        '<use href="#v%03d" transform="translate(%.0f,%.0f) '
                        'rotate(%.0f) scale(%.3f,%.3f)"/>'
                        % (n, x + dx, y + dy, otoceni, meritko * zrcadlo, meritko))

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
           'viewBox="0 0 %d %d">'
           '<defs>%s</defs>%s</svg>'
           % (DLAZDICE, DLAZDICE, DLAZDICE, DLAZDICE, ''.join(defs), ''.join(kusy)))

    io.open(ven, 'w', encoding='utf-8').write(svg)
    print('%s: %d B, %d druhů, %d×%d mřížka, %d vyobrazení'
          % (ven, len(svg), len(DRUHY), MRIZKA, MRIZKA, len(kusy)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
