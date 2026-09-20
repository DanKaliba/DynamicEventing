"""Vytáhne jednotlivé rostliny z plátu vesmir_kytky.pdf do SVG.

Plát je jedna stránka se 113 druhy vedle sebe, každý druh jako desítky
samostatných vektorových cest. Skript je seskupí (union-find nad obalovými
obdélníky), drobné odštěpky přilepí k nejbližší rostlině a každou rostlinu
uloží jako <g> s počátkem ve **středu spodní hrany** a výškou 100 jednotek.
Ten počátek je schválně: generátor louky pak rostlinu jen posune na místo
a zvětší, nemusí nic dopočítávat.

Výstup:
  kytky.svg    <defs> se všemi rostlinami
  kytky.json   index: id, šířka při výšce 100, barvy
"""

import json
import sys
from collections import defaultdict

import fitz

MIN_PLOCHA = 200      # pt², pod tím to není rostlina ale odštěpek
MAX_PRILEPIT = 8      # pt, dál už odštěpek k rostlině nepatří


def barva(c):
    if c is None:
        return None
    return '#{:02X}{:02X}{:02X}'.format(*(max(0, min(255, int(round(x * 255)))) for x in c))


def cesta_na_d(pa):
    """Převede fitz cestu na SVG atribut d."""
    kusy = []
    posledni = None
    for it in pa['items']:
        druh = it[0]
        if druh == 'l':
            p1, p2 = it[1], it[2]
            if posledni is None or (abs(posledni.x - p1.x) > 1e-6 or abs(posledni.y - p1.y) > 1e-6):
                kusy.append(f'M{p1.x:.2f},{p1.y:.2f}')
            kusy.append(f'L{p2.x:.2f},{p2.y:.2f}')
            posledni = p2
        elif druh == 'c':
            p1, p2, p3, p4 = it[1], it[2], it[3], it[4]
            if posledni is None or (abs(posledni.x - p1.x) > 1e-6 or abs(posledni.y - p1.y) > 1e-6):
                kusy.append(f'M{p1.x:.2f},{p1.y:.2f}')
            kusy.append(f'C{p2.x:.2f},{p2.y:.2f} {p3.x:.2f},{p3.y:.2f} {p4.x:.2f},{p4.y:.2f}')
            posledni = p4
        elif druh == 're':
            r = it[1]
            kusy.append(f'M{r.x0:.2f},{r.y0:.2f}H{r.x1:.2f}V{r.y1:.2f}H{r.x0:.2f}Z')
            posledni = None
        elif druh == 'qu':
            q = it[1]
            kusy.append(f'M{q.ul.x:.2f},{q.ul.y:.2f}L{q.ur.x:.2f},{q.ur.y:.2f}'
                        f'L{q.lr.x:.2f},{q.lr.y:.2f}L{q.ll.x:.2f},{q.ll.y:.2f}Z')
            posledni = None
    if pa.get('closePath'):
        kusy.append('Z')
    return ''.join(kusy)


class Sjednoceni:
    def __init__(self, n):
        self.rodic = list(range(n))

    def najdi(self, a):
        while self.rodic[a] != a:
            self.rodic[a] = self.rodic[self.rodic[a]]
            a = self.rodic[a]
        return a

    def spoj(self, a, b):
        ra, rb = self.najdi(a), self.najdi(b)
        if ra != rb:
            self.rodic[rb] = ra


def prekryv(r1, r2, mezera=0.0):
    return not (r1.x1 + mezera < r2.x0 or r2.x1 + mezera < r1.x0 or
                r1.y1 + mezera < r2.y0 or r2.y1 + mezera < r1.y0)


def vzdalenost(r1, r2):
    dx = max(0, max(r1.x0 - r2.x1, r2.x0 - r1.x1))
    dy = max(0, max(r1.y0 - r2.y1, r2.y0 - r1.y1))
    return (dx * dx + dy * dy) ** 0.5


def obal(cesty, indexy):
    return (min(cesty[i]['rect'].x0 for i in indexy),
            min(cesty[i]['rect'].y0 for i in indexy),
            max(cesty[i]['rect'].x1 for i in indexy),
            max(cesty[i]['rect'].y1 for i in indexy))


def main(pdf, ven_svg, ven_json):
    dok = fitz.open(pdf)
    stranka = dok[0]

    cesty = [pa for pa in stranka.get_drawings()
             if pa['rect'].height < stranka.rect.height * 0.9
             and pa['rect'].width > 0.01 and pa['rect'].height > 0.01]

    # --- seskupení ---
    uf = Sjednoceni(len(cesty))
    bunka = 12
    mrizka = defaultdict(list)
    for i, pa in enumerate(cesty):
        r = pa['rect']
        for gx in range(int(r.x0 // bunka), int(r.x1 // bunka) + 1):
            for gy in range(int(r.y0 // bunka), int(r.y1 // bunka) + 1):
                mrizka[(gx, gy)].append(i)
    for kandidati in mrizka.values():
        for a_i in range(len(kandidati)):
            for b_i in range(a_i + 1, len(kandidati)):
                a, b = kandidati[a_i], kandidati[b_i]
                if uf.najdi(a) != uf.najdi(b) and prekryv(cesty[a]['rect'], cesty[b]['rect']):
                    uf.spoj(a, b)

    skupiny = defaultdict(list)
    for i in range(len(cesty)):
        skupiny[uf.najdi(i)].append(i)
    skupiny = list(skupiny.values())

    # --- velké = rostliny, malé = odštěpky k přilepení ---
    rostliny, odstepky = [], []
    for s in skupiny:
        x0, y0, x1, y1 = obal(cesty, s)
        (rostliny if (x1 - x0) * (y1 - y0) >= MIN_PLOCHA else odstepky).append(s)

    prilepeno = 0
    for o in odstepky:
        ro = fitz.Rect(*obal(cesty, o))
        nejlepsi, nejblize = None, MAX_PRILEPIT
        for idx, r in enumerate(rostliny):
            d = vzdalenost(ro, fitz.Rect(*obal(cesty, r)))
            if d < nejblize:
                nejlepsi, nejblize = idx, d
        if nejlepsi is not None:
            rostliny[nejlepsi].extend(o)
            prilepeno += 1

    # Zleva doprava, shora dolů — ať index odpovídá pořadí na plátu.
    rostliny.sort(key=lambda s: (round(obal(cesty, s)[1] / 40), obal(cesty, s)[0]))

    defs, index = [], []
    for n, s in enumerate(rostliny):
        x0, y0, x1, y1 = obal(cesty, s)
        w, h = x1 - x0, y1 - y0
        meritko = 100.0 / h
        ident = f'k{n:03d}'

        # Počátek do středu spodní hrany, osa y nahoru zůstává záporná.
        # Pozor: ve `scale(m) translate(t)` se posun aplikuje PŘED zvětšením,
        # takže se zadává v původních jednotkách, ne vynásobený měřítkem.
        posun = f'translate({-(x0 + w / 2):.2f},{-y1:.2f})'
        kusy = [f'<g id="{ident}" transform="scale({meritko:.4f}) {posun}">']

        barvy = set()
        for i in s:
            pa = cesty[i]
            d = cesta_na_d(pa)
            if not d:
                continue
            vypln = barva(pa.get('fill'))
            tah = barva(pa.get('color'))
            atr = [f'd="{d}"']
            atr.append(f'fill="{vypln}"' if vypln else 'fill="none"')
            if tah:
                atr.append(f'stroke="{tah}"')
                atr.append(f'stroke-width="{max(pa.get("width") or 0.3, 0.3):.2f}"')
            if pa.get('even_odd'):
                atr.append('fill-rule="evenodd"')
            kusy.append('<path ' + ' '.join(atr) + '/>')
            if vypln:
                barvy.add(vypln)

        kusy.append('</g>')
        defs.append(''.join(kusy))
        index.append({
            'id': ident,
            'sirka': round(w * meritko, 1),   # při výšce 100
            'vyska_pt': round(h, 1),          # původní výška na plátu
            'barvy': sorted(barvy),
            'cest': len(s),
        })

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
           '<defs>' + ''.join(defs) + '</defs></svg>')

    open(ven_svg, 'w', encoding='utf-8').write(svg)
    json.dump(index, open(ven_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'rostlin: {len(rostliny)}  (odštěpků přilepeno: {prilepeno}/{len(odstepky)})')
    print(f'{ven_svg}: {len(svg)} B')
    vysky = sorted(r['vyska_pt'] for r in index)
    print(f'výšky na plátu: min {vysky[0]}, medián {vysky[len(vysky)//2]}, max {vysky[-1]} pt')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
