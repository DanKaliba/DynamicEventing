"""Vytáhne jednu rostlinu z botanického archivu pro okrajovou dekoraci sekcí.

Na rozdíl od louky (96 rostlin, procedurální rozmístění) jde o jedinou
kytku, co se přes CSS (.sekce::after v style.css) objeví v postranním
okraji na konci každé sekce — beze změn v HTML, čistě CSS pozadí.

Barva se přemaluje na paletu webu stejně jako v louce (tools/louka.py):
botanická ilustrace dodá tvar, skutečnou barvu dodá fotka louky
(tools/paleta.py), ne originální ilustrace z Vesmíru.

Výstup je samostatné <svg viewBox="…">, ne sprite s <defs> — použije se
přes CSS background-image, který cross-document <use> ani nepodporuje.
Přes background-image navíc barvu nejde měnit proměnnou motivu, takže
--silenka je tu napevno jako hex, ne var(--silenka).

Použití:
    python tools/kytky-okraj.py tools/kytky-vse.svg assets/kytky-okraj.svg
"""

import io
import re
import sys

# Archiv číslo → cílová barva květu. --silenka (#C96EA6) je navzorkovaná
# přímo z fotky louky (tools/paleta.py) — stejná rodina jako zbytek webu,
# ne barva vymyšlená od oka pro tuhle jednu kytku.
VYBER = "k083"
BARVA_KVETU_CILOVA = "#C96EA6"

BARVA_KVETU_PUVODNI = "#EC6491"
BARVA_ZELENE_PUVODNI = "#396810"
BARVA_ZELENE_CILOVA = "#496E16"  # --trava-tmava

# Kytky v archivu mají počátek ve středu paty a výšku ~100 jednotek
# (viz tools/extrakce.py) — stačí orámovat viewBox kolem toho, přesné
# rozměry nejsou kritické, jen ať se nic neusekne.
SIRKA_RAMU = 44
VYSKA_RAMU = 108
ODSAZENI_DOLE = 4


def nacti_def(cesta, id_):
    svg = io.open(cesta, encoding="utf-8").read()
    m = re.search(rf'<g id="{id_}".*?</g>(?=<g id="k|</defs>)', svg, re.S)
    if not m:
        raise SystemExit(f"{id_} není v archivu — zkontroluj {cesta}")
    return m.group(0)


def main(vstup, vystup):
    telo = nacti_def(vstup, VYBER)
    telo = telo.replace(BARVA_KVETU_PUVODNI, BARVA_KVETU_CILOVA)
    telo = telo.replace(BARVA_ZELENE_PUVODNI, BARVA_ZELENE_CILOVA)
    telo = re.sub(r'id="k\d{3}"\s*', "", telo, count=1)

    x0 = -SIRKA_RAMU / 2
    y0 = -(VYSKA_RAMU - ODSAZENI_DOLE)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="{x0} {y0} {SIRKA_RAMU} {VYSKA_RAMU}">{telo}</svg>'
    )
    io.open(vystup, "w", encoding="utf-8").write(svg)
    print(f"{vystup}: {len(svg)} znaků")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
