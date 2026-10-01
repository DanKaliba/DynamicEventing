"""Hvězdná obloha nad Himmelreichem ve svatební noc → assets/hvezdy.svg.

Skutečné polohy hvězd 19. 6. 2027 ve 23:30 (SELČ) nad Himmelreichem,
pohled k jihovýchodu až jihozápadu. Na webu se ukazuje každou noc stejná
— je to obloha té noci, ne obloha dneška.

Katalog (jasné hvězdy z HYG, přes projekt d3-celestial, BSD-3) se při
spuštění stáhne, v repu není. Souřadnice v katalogu jsou RA ve stupních
v rozsahu -180..180 a deklinace.

Projekce je obyčejná: azimut → x, výška nad obzorem → y. V téhle výšce
oblohy je zkreslení vidět jen u tvarů vysoko nad hlavou.

    python tools/hvezdy.py              # zapíše assets/hvezdy.svg
    python tools/hvezdy.py --vypis      # jen vypíše, co je vidět
"""

import json
import math
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

LAT, LON = 50.8019203, 14.0456936          # Himmelreich, viz tools/mapa.py
CAS = datetime(2027, 6, 19, 23, 30, tzinfo=timezone(timedelta(hours=2)))

AZ_OD, AZ_DO = 50, 270    # stupně azimutu: od VSV přes jih po západ
VYSKA_MAX = 75            # stupně nad obzorem nahoře v obrázku
MERITKO = 10              # jednotek viewBoxu na stupeň
MAG_LIMIT = 4.2           # slabší by v soumraku a za úplňku vidět nebyly

ZDROJ = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/'


def stahnout(soubor):
    with urllib.request.urlopen(ZDROJ + soubor) as r:
        return json.loads(r.read().decode('utf-8'))


def julian(dt):
    return dt.timestamp() / 86400 + 2440587.5


def vyska_azimut(ra, dec, jd):
    gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360
    h = math.radians((gmst + LON - ra) % 360)
    la, de = math.radians(LAT), math.radians(dec)
    alt = math.asin(math.sin(la) * math.sin(de) + math.cos(la) * math.cos(de) * math.cos(h))
    az = math.atan2(-math.sin(h) * math.cos(de),
                    math.cos(la) * math.sin(de) - math.sin(la) * math.cos(de) * math.cos(h))
    return math.degrees(alt), math.degrees(az) % 360


def barva(bv):
    """Barevný index B-V → studená bílá s nepatrným rozdílem mezi hvězdami.
    Teplé odstíny tu schválně nejsou — splývaly by se světluškami."""
    try:
        bv = float(bv)
    except (TypeError, ValueError):
        return '#EEF3FF'
    t = max(0.0, min(1.0, (bv + 0.2) / 1.8))
    studena, tepla = (214, 226, 255), (248, 250, 255)
    return '#{:02X}{:02X}{:02X}'.format(*(round(s + (w - s) * t) for s, w in zip(studena, tepla)))


def main():
    jd = julian(CAS)
    hvezdy = stahnout('stars.6.json')['features']

    viditelne = []
    for h in hvezdy:
        mag = h['properties']['mag']
        if mag > MAG_LIMIT:
            continue
        ra, dec = h['geometry']['coordinates']
        alt, az = vyska_azimut(ra % 360, dec, jd)
        if alt < 0 or alt > VYSKA_MAX or not (AZ_OD <= az <= AZ_DO):
            continue
        viditelne.append((mag, alt, az, h['properties'].get('bv')))

    if '--vypis' in sys.argv:
        print(f'hvězd v záběru: {len(viditelne)}')
        return

    W = (AZ_DO - AZ_OD) * MERITKO
    H = VYSKA_MAX * MERITKO
    kusy = []
    for mag, alt, az, bv in sorted(viditelne, reverse=True):
        x = (az - AZ_OD) * MERITKO
        y = H - alt * MERITKO
        # Ostré drobné body (1 jednotka ≈ 1 px). Velikostí se liší jen
        # málo, jasnost hlavně sytostí — velké kotouče se světluškami pletly.
        r = 0.7 + (MAG_LIMIT - mag) * 0.3
        pruhl = min(1.0, 0.7 + (MAG_LIMIT - mag) * 0.1)
        kusy.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" '
                    f'fill="{barva(bv)}" opacity="{pruhl:.2f}"/>')
        if mag < 1.5:
            # Nejjasnější (Vega, Arktur, Altair, Deneb, Antares) mají
            # jen těsný studený závoj, ne velkou záři.
            kusy.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * 2.5:.1f}" '
                        f'fill="url(#zare)" opacity="0.6"/>')

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
           f'preserveAspectRatio="xMidYMax slice">'
           '<defs><radialGradient id="zare">'
           '<stop offset="0" stop-color="#DCE6FF" stop-opacity="0.7"/>'
           '<stop offset="1" stop-color="#DCE6FF" stop-opacity="0"/>'
           '</radialGradient></defs>'
           + ''.join(kusy) + '</svg>')

    with open('assets/hvezdy.svg', 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f'assets/hvezdy.svg: {len(svg)} B, hvězd {len(viditelne)}')


if __name__ == '__main__':
    main()
