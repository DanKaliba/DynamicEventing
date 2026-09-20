# Svatba na Himmelreichu

Statická jednostránka. Žádný build, žádný framework, žádný externí request —
otevřeš `index.html` v prohlížeči a funguje.

```
index.html           obsah; sekce oddělené komentáři, louka vložená jako inline SVG
assets/style.css     paleta, theming, layout
assets/gallery.js    ← seznam fotek, jediné místo k editaci galerie
assets/main.js       odpočet, lightbox, přepínač motivu, stav navigace
assets/fonts/        Fraunces (nadpisy) a Inter (text), lokálně
assets/img/          fotky
tools/louka.py       generátor louky v hero sekci
tools/paleta.py      vzorkovač barev z fotky
```

---

## 1. Doplnit obsah

Všechno k vyplnění je v `index.html` v hranatých závorkách velkými písmeny:

```powershell
Select-String -Path index.html -Pattern "\[[A-ZÁ-Ž]"
```

Jména, datum, adresa, odkaz na mapy, telefony, e-maily, časy, číslo účtu.
Texty sekcí (proč přijet, co na sebe, dotazy) jsou napsané — přepiš je podle
sebe, jsou to jen návrhy.

Odpočet se řídí atributem `data-datum` u `<p class="odpocet">`, formát
`RRRR-MM-DDTHH:MM`. Ukazuje dny, ne vteřiny, a po svatbě se sám schová.

## 2. Přidat fotky

1. Zmenši je — šířka max 2000 px, JPEG kvalita ~80, pod 500 kB/kus.
2. Nahraj do `assets/img/`. Názvy bez diakritiky a mezer: `obrad-01.jpg`.
3. Přidej řádek do `assets/gallery.js`:

```js
window.GALERIE = [
  { src: 'assets/img/obrad-01.jpg', popis: 'Obřad na louce', sirka: 2000, vyska: 1333 },
];
```

`popis` je krátký popis fotky — potřebný pro odečítače obrazovky.
`sirka`/`vyska` jsou volitelné, ale bez nich stránka při načítání poskakuje.
Dokud je seznam prázdný, ukazuje se hláška „Sem přijdou fotky ze svatby".

## 3. Zveřejnit

Repo je veřejné a GitHub Pages běží z větve `main`, složka `/ (root)`.
Každá změna tedy jde ven takhle:

```powershell
git add -A
git commit -m "Doplněna jména a datum"
git push
```

Za 1–2 minuty je to na **https://dankaliba.github.io/DynamicEventing/**.
Průběh nasazení je v záložce Actions.

### Soukromí

Web je veřejný — kdokoli s odkazem ho uvidí. `<meta name="robots" content="noindex">`
ho drží mimo vyhledávače, ale není to zámek. Než tam dáš číslo účtu a telefony,
zvaž to.

---

## Design

### Paleta

Barvy jsou **navzorkované z fotky květnaté louky**, ne vybrané od oka.
`tools/paleta.py` projde fotku, rozdělí pixely podle odstínu a v každém pásmu
vezme medián dostatečně sytých bodů (medián, ne průměr — ten by sousední
odstíny smíchal do šedi).

| proměnná | hex | z čeho |
|---|---|---|
| `--les` | `#0C1A06` | tmavý živý plot za loukou |
| `--mak` | `#CC030E` | vlčí mák |
| `--chrpa` | `#175ACA` | chrpa |
| `--pryskyrnik` | `#D2BB31` | pryskyřník |
| `--trava` | `#99B949` | osvětlená tráva |
| `--trava-tmava` | `#496E16` | tráva ve stínu |
| `--kopretina` | `#ECEEE7` | kopretina |

Všechny dvojice text/pozadí jsou ověřené na WCAG AA (≥ 4.5:1), v obou
motivech. `--pryskyrnik` se na světlém pozadí **nesmí** použít na text —
má kontrast 1.75:1. Je jen pro ilustraci a pro tmavý motiv.

Znovu navzorkovat z jiné fotky:

```bash
python tools/paleta.py cesta/k/fotce.jpg
```

### Louka

Hero je tmavý les, ze spodní hrany vyrůstá louka — inline SVG, 112 stonků ve
třech vrstvách. Generuje ho `tools/louka.py` s pevným seedem, takže výstup je
reprodukovatelný. Hlavičky květů jsou v `<defs>` a používají se přes `<use>`;
bez toho by SVG mělo přes 150 kB, takhle má 68 kB (po gzipu 9 kB).

Přegenerovat po úpravě (hustota, poměr druhů, barvy):

```bash
python tools/louka.py > /tmp/louka.svg
# pak ručně nahradit <svg class="louka">…</svg> v index.html
```

### Motion

Na stránce je **jediná animace**: louka jednou vyroste při načtení, zleva
doprava. Nic dalšího se nehýbe. Pod `prefers-reduced-motion: reduce` se
nespustí a louka je rovnou vzrostlá.

### Typografie

Nadpisy **Fraunces** — old-style serif s měkkými, trochu nepravidelnými tahy;
působí ručně, ne kaligraficky. Text **Inter**. Oba lokálně, žádný request na
Google Fonts (a tedy ani žádné sledování hostů).

---

## Poznámka k téhle složce

`index-cz.html` a `workflow-demo-cz.html` jsou interní Košík BI prezentace,
které tu ležely předtím. Jsou v `.gitignore`, aby se nedostaly do veřejného
repa. Nemaž ty řádky.
