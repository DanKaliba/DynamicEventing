"""Poskládá louku z botanických ilustrací vytažených z vesmir_kytky.pdf.

Na rozdíl od první verze se květy nekreslí — používají se hotové rostliny
z plátu (extrakce.py). Každá rostlina má počátek ve středu spodní hrany
a výšku 100 jednotek, takže umístit ji znamená posunout a zvětšit.

Výstup je **samostatný soubor** assets/louka.svg, ne vložený do HTML:
definice rostlin jsou velké a takhle se cachují zvlášť a nenafukují
stránku.

SVG je záměrně statické. Dřív rostla každá rostlina zvlášť animací uvnitř
SVG, jenže dokud animace nedoběhne, je louka slisovaná u země — a cokoli,
co stránku vykreslí staticky (náhled odkazu, tisk, snímek obrazovky),
tenhle stav chytí. Nástup teď řeší stránka jedním pohybem celé louky,
takže když animace neproběhne, louka je prostě na místě.

Poměr stran je schválně hodně široký (8:1). Když je rámeček v CSS užší
než tenhle poměr, object-fit: cover ořízne boky; kdyby byl širší, uřízl
by rostlinám hlavy.
"""

import io
import json
import random
import re
import sys

W, H = 3000, 300

# Vybráno z plátu tak, aby byly zastoupené všechny barvy a soubor zůstal
# rozumně velký. Čísla odpovídají pořadí na plátu (viz prehled.svg).
DRUHY = {
    'zluté':   [7, 29, 40, 55, 96, 102],
    'růžové':  [13, 14, 44, 83, 104],
    'fialové': [21, 72, 76, 91, 103, 109],
    'bílé':    [42, 88, 90],
    'červené': [68, 99, 106],
    'trávy':   [32, 58, 71, 84, 92, 101],
}

# Trávy jsou výplň, mají padat častěji než jednotlivé kvetoucí druhy.
VAHY = (
    DRUHY['zluté'] * 3 + DRUHY['růžové'] * 3 + DRUHY['fialové'] * 3 +
    DRUHY['bílé'] * 3 + DRUHY['červené'] * 3 + DRUHY['trávy'] * 7
)


def nacti_definice(cesta_svg):
    svg = io.open(cesta_svg, encoding='utf-8').read()
    return {ident: txt for txt, ident
            in re.findall(r'(<g id="(k\d{3})".*?</g>)(?=<g id="k|</defs>)', svg, re.S)}


def zjemni(txt):
    """Zkrátí souřadnice na jedno desetinné místo. Na výsledku to není
    vidět a soubor spadne zhruba o desetinu."""
    return re.sub(r'(\d+)\.(\d)\d+', r'\1.\2', txt)


def vrstva(pocet, vysky, pruhlednost, trida, rng):
    kusy = []
    for i in range(pocet):
        # Rovnoměrně s rozptylem — ne mřížka, ale ani shluky.
        x = (i + rng.uniform(-0.5, 0.5)) * (W / pocet)
        x = max(-40, min(W + 40, x))
        vyska = rng.uniform(*vysky)
        meritko = vyska / 100.0
        druh = rng.choice(VAHY)
        # Půlka rostlin zrcadlově — plát má každý druh jen v jedné poloze.
        zrcadlo = -1 if rng.random() < 0.5 else 1
        # Dva obaly schválně: vnější nese posun jako atribut, vnitřní je
        # volný pro CSS transform (ohyb ve větru). Kdyby bylo obojí na
        # jednom prvku, CSS transform by posun přepsal.
        kusy.append(
            f'<g transform="translate({x:.0f},{H})">'
            f'<g class="kytka">'
            f'<use href="#k{druh:03d}" transform="scale({meritko * zrcadlo:.3f},{meritko:.3f})"/>'
            f'</g></g>')

    return f'<g class="{trida}" opacity="{pruhlednost}">' + ''.join(kusy) + '</g>'


def main(kytky_svg, ven, pozadi=None):
    definice = nacti_definice(kytky_svg)
    rng = random.Random(20270619)  # datum svatby

    pouzite = sorted({n for ns in DRUHY.values() for n in ns})
    defs = ''.join(zjemni(definice[f'k{n:03d}']) for n in pouzite)

    # Zadní vrstva je menší a průhlednější — na tmavém i světlém podkladu
    # to čte jako dálka, aniž by se musely přebarvovat výplně.
    zadni = vrstva(58, (105, 190), 0.55, 'vrstva-zadni', rng)
    predni = vrstva(38, (175, 290), 1, 'vrstva-predni', rng)

    podklad = f'<rect width="100%" height="100%" fill="{pozadi}"/>' if pozadi else ''

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
           f'preserveAspectRatio="xMidYMax slice" role="img" '
           f'aria-label="Kreslená louka lučních rostlin">'
           f'<defs>{defs}</defs>{podklad}{zadni}{predni}</svg>')

    io.open(ven, 'w', encoding='utf-8').write(svg)
    print(f'{ven}: {len(svg)} B, druhů {len(pouzite)}, rostlin 96')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
