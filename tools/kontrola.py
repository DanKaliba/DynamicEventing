"""Kontrola stránky před zveřejněním: zbylé zástupné texty a nefunkční odkazy.

Code review vidí jen změněný kód a odkazy neotvírá — tohle projde celý
index.html a odkazy opravdu načte.

Hlídá:
  - zástupné texty: [VELKÁ PÍSMENA], __ID_FORMULARE__, entry.10000000XX
  - externí odkazy (href, src, action): načte je a chce odpověď 2xx
  - místní soubory (assets/…): musí existovat
  - kotvy (#kde): na stránce musí být prvek s tím id

Odkazy se načítají GETem, ne HEADem — mapy.com na HEAD vrací 404, i když
odkaz funguje.

    python tools/kontrola.py            # vše
    python tools/kontrola.py --offline  # bez načítání externích odkazů

Návratový kód 1, když něco najde.
"""

import os
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser

STRANKA = 'index.html'
ZASTUPNE = [
    (re.compile(r'\[[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9 ]+\]'), 'zástupný text'),
    (re.compile(r'__[A-Z_]+__'), 'zástupné ID'),
    (re.compile(r'entry\.10000000\d\d'), 'zástupné číslo pole formuláře'),
]


class Odkazy(HTMLParser):
    def __init__(self):
        super().__init__()
        self.odkazy = []   # (atribut, hodnota, řádek)
        self.idcka = set()

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k == 'id' and v:
                self.idcka.add(v)
            if k in ('href', 'src', 'action') and v:
                self.odkazy.append((k, v, self.getpos()[0]))


def nacist(url):
    pozadavek = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (kontrola odkazu)'})
    try:
        with urllib.request.urlopen(pozadavek, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:  # síť, DNS, timeout
        return type(e).__name__


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    koren = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cesta = os.path.join(koren, STRANKA)
    text = open(cesta, encoding='utf-8').read()
    offline = '--offline' in sys.argv
    problemy = []

    for cislo, radek in enumerate(text.splitlines(), 1):
        for vzor, popis in ZASTUPNE:
            for m in vzor.finditer(radek):
                problemy.append(f'{STRANKA}:{cislo}  {popis}: {m.group(0)}')

    parser = Odkazy()
    parser.feed(text)

    externi = {}
    for atribut, hodnota, cislo in parser.odkazy:
        if ZASTUPNE[0][0].search(hodnota) or ZASTUPNE[1][0].search(hodnota):
            continue  # už nahlášené jako zástupný text
        if hodnota.startswith(('http://', 'https://')):
            externi.setdefault(hodnota, cislo)
        elif hodnota.startswith('#'):
            if len(hodnota) > 1 and hodnota[1:] not in parser.idcka:
                problemy.append(f'{STRANKA}:{cislo}  kotva bez cíle: {hodnota}')
        elif hodnota.startswith(('mailto:', 'tel:', 'data:', 'javascript:')):
            continue
        else:
            soubor = hodnota.split('#')[0].split('?')[0]
            if soubor and not os.path.exists(os.path.join(koren, soubor)):
                problemy.append(f'{STRANKA}:{cislo}  chybí soubor: {soubor}')

    if offline:
        print(f'externí odkazy přeskočeny ({len(externi)})')
    else:
        for url, cislo in sorted(externi.items(), key=lambda x: x[1]):
            stav = nacist(url)
            if not (isinstance(stav, int) and 200 <= stav < 300):
                problemy.append(f'{STRANKA}:{cislo}  odkaz nefunguje ({stav}): {url}')
        print(f'načteno externích odkazů: {len(externi)}')

    if problemy:
        print(f'\nNalezeno {len(problemy)}:')
        for p in problemy:
            print('  ' + p)
        return 1
    print('Vše v pořádku.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
