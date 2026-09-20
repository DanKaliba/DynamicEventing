# Svatba na Himmelreichu

Statická jednostránka. Žádný build, žádný framework, žádný externí request —
otevřeš `index.html` v prohlížeči a funguje.

```
index.html           obsah; sekce oddělené komentáři
assets/style.css     paleta, theming, layout
assets/gallery.js    ← seznam fotek, jediné místo k editaci galerie
assets/main.js       odpočet, lightbox, přepínač motivu, stav navigace
assets/fonts/        Fraunces (nadpisy) a Inter (text), lokálně
assets/img/          fotky
assets/louka.svg     louka v hero sekci (samostatný soubor, cachuje se zvlášť)
tools/extrakce.py    rozseká plát z PDF na jednotlivé rostliny
tools/louka.py       poskládá z nich louku
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

Hero je tmavý les a u spodní hrany stojí louka: **96 rostlin ve dvou
vrstvách, 29 botanických druhů**. Nejsou kreslené — jsou vytažené
z `vesmir_kytky.pdf` (ilustrace Jan Roleček, Vesmír), plátu se 113 druhy
karpatských lesostepních luk.

`tools/extrakce.py` plát rozseká: seskupí vektorové cesty union-findem nad
obalovými obdélníky, drobné odštěpky přilepí k nejbližší rostlině a každou
uloží s počátkem ve středu spodní hrany a výškou 100 jednotek.
`tools/louka.py` z nich pak poskládá louku s pevným seedem.

```bash
python tools/extrakce.py vesmir_kytky.pdf tools/kytky-vse.svg tools/kytky-vse.json
python tools/louka.py tools/kytky-vse.svg assets/louka.svg
```

**Zdrojový plát ani všech 114 vytažených rostlin nejsou v repu** (viz
`.gitignore`) — do veřejného repa cizí dílo celé nepatří. Ven jde jen
výsledná louka s 29 použitými druhy. Bez lokální kopie PDF tedy první
příkaz neprojde.

Louka je **samostatný soubor**, ne inline SVG. Definice rostlin jsou velké
(152 kB, po gzipu 40 kB) a takhle se cachují zvlášť místo aby zdržovaly
první vykreslení stránky.

Poměr stran SVG je 10:1 a `--vyska-louky` se váže na **šířku** okna, ne na
výšku. Díky tomu je rámeček vždycky užší v poměru než obrázek, takže
`object-fit: cover` ořízne boky a ne vršky rostlin.

### Motion

Na stránce je **jediná animace**: louka jednou najede zespodu na místo.
Nic dalšího se nehýbe, a pod `prefers-reduced-motion: reduce` ani ona.

Dřív rostla animací každá rostlina zvlášť zevnitř SVG. Vypadalo to líp, ale
dokud animace nedoběhla, byla louka slisovaná u země — a cokoli, co stránku
vykreslí staticky (náhled odkazu, tisk, generátor snímků), tenhle stav
chytilo. Teď je SVG statické a nástup řeší stránka: když animace neproběhne,
louka je prostě na místě.

### Typografie

Nadpisy **Fraunces** — old-style serif s měkkými, trochu nepravidelnými tahy;
působí ručně, ne kaligraficky. Text **Inter**. Oba lokálně, žádný request na
Google Fonts (a tedy ani žádné sledování hostů).

---

## Poznámka k téhle složce

`index-cz.html` a `workflow-demo-cz.html` jsou interní Košík BI prezentace,
které tu ležely předtím. Jsou v `.gitignore`, aby se nedostaly do veřejného
repa. Nemaž ty řádky.

## Ilustrace

Rostliny v louce pocházejí z plátu „Ilustrace pestrosti tvarů a barev květeny
karpatských lesostepních luk“, text a ilustrace **Jan Roleček**, Vesmír.
Použité jako podklad pro `assets/louka.svg`. Jde o autorské dílo — pokud
má web zůstat veřejný delší dobu, stojí za to napsat autorovi nebo redakci.
