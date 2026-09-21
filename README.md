# Svatba na Himmelreichu

Statická jednostránka. Žádný build, žádný framework, žádný externí request —
otevřeš `index.html` v prohlížeči a funguje.

```
index.html          obsah; sekce oddělené komentáři
assets/style.css    paleta, theming, layout
assets/gallery.js   ← seznam fotek, jediné místo k editaci galerie
assets/main.js      odpočet, lightbox, přepínač motivu, stav navigace
assets/vitr.js      vítr v louce (reakce na kurzor, dotyk a scroll)
assets/rsvp.js      odeslání potvrzení účasti do Google Formuláře
assets/fonts/       Fraunces (nadpisy) a Inter (text), lokálně
assets/img/         fotky
assets/louka.svg    louka v hero sekci (samostatný soubor, cachuje se zvlášť)
assets/vzor.svg     obrysy rostlin na pozadí sekcí, jako maska
tools/extrakce.py   rozseká plát z PDF na jednotlivé rostliny
tools/louka.py      poskládá z nich louku
tools/vzor.py       poskládá z nich opakovatelnou dlaždici na pozadí
tools/mapa.py       mapka ubytování z reálných GPS souřadnic (vložená přímo v index.html)
tools/paleta.py     vzorkovač barev z fotky
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

## 3. Napojit potvrzení účasti

Formulář na stránce odesílá do Google Formuláře, odpovědi padají do Sheetu.
Web je statický, žádný backend tu není — tohle je způsob, jak se obejít
bez něj a přitom si nechat vlastní vzhled.

**Dokud není napojený, sám se schová** a místo něj se ukáže odkaz na
e-mail. Tiše mizející potvrzení účasti je horší než žádný formulář: chybu
bys poznal až podle prázdných židlí.

### a) Založit formulář

V Google Formulářích vytvoř formulář se **sedmi otázkami v tomhle pořadí**
(na názvech nezáleží, na pořadí a typu ano):

| # | otázka | typ | povinná |
|---|---|---|---|
| 1 | Kdo se hlásí | krátká odpověď | ano |
| 2 | Přijedete? | výběr z možností: `Přijedeme`, `Bohužel nedorazíme` | ano |
| 3 | Kolik vás bude | krátká odpověď | ne |
| 4 | Co nejíte | krátká odpověď | ne |
| 5 | Místo v autobuse | výběr: `Ano`, `Ne` | ne |
| 6 | Spaní na chalupě | výběr: `Ano`, `Ne` | ne |
| 7 | Vzkaz | odstavec | ne |

U otázek 2, 5 a 6 musí být možnosti napsané **přesně takhle**, jinak Google
odpověď zahodí. Nenastavuj žádnou otázku jako povinnou v Googlu — hlídá si
to stránka sama a povinné pole v Googlu by odmítlo odeslání, když někdo
napíše, že nedorazí.

### b) Zjistit čísla polí

V editoru formuláře: **⋮ → Získat předvyplněný odkaz**. Vyplň do všech
sedmi polí cokoliv a dej **Získat odkaz → Kopírovat odkaz**. Vznikne něco
jako:

```
https://docs.google.com/forms/d/e/1FAIpQLSdXXXXXXXX/viewform?usp=pp_url
  &entry.1234567890=test&entry.987654321=Přijedeme&entry.5555=2...
```

- `1FAIpQLSdXXXXXXXX` je **ID formuláře**
- `entry.1234567890` a spol. jsou **čísla polí**, v pořadí otázek

### c) Přepsat do index.html

V sekci `id="potvrzeni"`:

1. v `action=` nahraď `__ID_FORMULARE__` tím ID formuláře
2. sedm `name="entry.10000000XX"` nahraď skutečnými čísly, v pořadí
   podle tabulky výše

```powershell
Select-String -Path index.html -Pattern "entry\.|__ID_FORMULARE__"
```

Pak commitni, pushni a zkus formulář odeslat. Odpověď se musí objevit
v Googlu v záložce **Odpovědi**.

> **Co nejde zaručit:** prohlížeč kvůli pravidlům pro cizí domény
> neprozradí, co Google odpověděl. Stránka pozná jen to, že se něco
> vrátilo, ne že se odpověď uložila. Proto je pod formulářem e-mail a
> proto se vyplatí před svatbou počty v Sheetu porovnat se seznamem
> pozvaných.

Když později přidáš otázku, čísla polí se musí doplnit znovu — Google je
generuje při vytvoření otázky.

## 4. Zveřejnit

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

Poměr stran SVG je 10:1. `--vyska-louky` má strop podle šířky i výšky okna:
`clamp(9rem, min(20vw, 38vh), 22rem)`.

Strop podle šířky drží poměr rámečku užší než 10:1, takže `object-fit:
cover` ořezává boky a ne vršky rostlin. Strop podle výšky je tam proto, že
`min-height: 100svh` je jen minimum — na širokém a nízkém okně notebooku
obsah hero přerostl a spodek okna louku uřízl (na 1872×785 začínala až
na 75 % výšky a vidět byla sotva polovina). Zmenšovat výšku je bezpečné:
nižší rámeček je v poměru ještě užší. Nebezpečné by bylo zvětšovat šířku
bez výšky.

Dvě pravidla pro nízká okna utahují odsazení a zmenšují jména; pod 450 px
výšky (telefon na šířku) jde pryč i odpočet. Ověřeno od 360 do 1010 px
výšky — hero se nikde nevejde mimo obrazovku.

### Pozadí sekcí

Za obsahem sekcí (ne za hero ani patičkou — ty mají vlastní neprůhledné
pozadí) je tichá textura obrysů stejných rostlin jako v louce, jako
doodle pozadí ve WhatsAppu. Generuje ji `tools/vzor.py` — vezme siluety
z `tools/kytky-vse.svg`, výplně nahradí tahem a rozmístí je do
opakovatelné dlaždice 640×640 px.

```bash
python tools/vzor.py tools/kytky-vse.svg tools/kytky-vse.json assets/vzor.svg
```

Rozmístění je rozostřená mřížka (5×5 buněk, náhodný posun uvnitř každé),
ne čistě náhodné — čistě náhodné dělalo shluky, a protože se dlaždice
opakuje, jeden hustý shluk by se propsal jako nápadný pravidelný vzorek.
Rostlina přesahující přes okraj dlaždice se dokreslí i na protější
straně, jinak by byly vidět švy.

`assets/vzor.svg` je jeden černobílý soubor pro oba motivy. V CSS se
použije jako `mask-image` na `body::before` — barvu dodává
`background-color: var(--text)`, tvar jen maska. Sytost řídí
`--sytost-vzoru` (výchozí `0.05`, v tmavém motivu `0.07` — na tmavém
pozadí je stejná čára hůř vidět). Zesílit nebo úplně vypnout:

```css
:root { --sytost-vzoru: 0.1; }   /* silnější */
:root { --sytost-vzoru: 0; }     /* pryč */
```

Bez podpory `mask-image` (staré prohlížeče) se `body::before` vůbec
nevytvoří — `@supports` to hlídá. Jinak by se bez masky vykreslila plná
barevná vrstva přes celou stránku místo textury, což by bylo horší než
žádný vzor.

### Motion

Na stránce se hýbe jen louka, a jen jako odpověď na akci. **Trvalé kývání
na pozadí tam schválně není** — louka je v hero, byla by pořád na obrazovce
a 96 nepřetržitě animovaných prvků zbytečně žere baterku.

**Nástup.** Louka jednou najede zespodu na místo. Dřív rostla animací každá
rostlina zvlášť zevnitř SVG; vypadalo to líp, ale dokud animace nedoběhla,
byla louka slisovaná u země — a cokoli, co stránku vykreslí staticky (náhled
odkazu, tisk, generátor snímků), tenhle stav chytilo. Teď je SVG statické
a nástup řeší stránka: když animace neproběhne, louka je prostě na místě.

**Vítr** (`assets/vitr.js`). Louka je ve stránce jako `<img>`, což je plochý
obrázek — dovnitř se nedostane myš ani skript. Skript ji proto po načtení
stáhne a vloží do DOMu jako živé SVG. Selže-li to, zůstane obrázek.

> Kvůli tomu **vítr nefunguje při otevření `index.html` přes `file://`** —
> prohlížeč tam nepovolí `fetch` na sousední soubor. Lokálně spusť
> `python -m http.server` a otevři `http://localhost:8000`.

Tři vstupy, všechny přes Pointer Events, takže jeden kód obslouží myš, pero
i prst:

| vstup | co dělá |
|---|---|
| pohyb kurzoru / tah prstem | rostliny se uhýbají, silněji zblízka a při rychlém pohybu |
| ťuknutí / kliknutí | poryv z toho místa, rozbíhá se do stran a doběhne |
| scroll | závan přeletí loukou od kraje ke kraji, rychlost podle scrollu |

Posluchače sedí na celém `.hero`, ne na louce. Louka má `pointer-events:
none`, aby nepřekážela výběru textu, takže přímo na ni by žádná událost
myši nedošla — a navíc je tím vítr citlivější, stačí přejet heroem.

Hýbe se jen ~15 rostlin kolem kurzoru, zbytek se v cyklu přeskakuje.
Louka je navíc širší než okno (viewBox 10:1 ořezaný na boky), takže
zhruba polovina rostlin je mimo záběr; ty se označí v `zmerit()` a
přeskakují se úplně. Smyčka `requestAnimationFrame` se po uklidnění sama
zastaví. Pod `prefers-reduced-motion: reduce` se SVG ani nevkládá.

Ohyb je tlumená pružina, `uhel += rychlost` po snímcích. Konstanty nejsou
od oka — rekurence se dá přehrát mimo prohlížeč a změřit, takže
`TUHOST = 0.06` a `TLUMENI = 0.80` jsou vybrané z mřížky: náběh 0,13 s,
překmit 18 %, klid 0,40 s. Tužší kombinace se usadí za 0,18 s, ale pohyb
pak působí mechanicky. Kvůli tomu překmitu vyjede úhel o pětinu nad
`MAX_UHEL`, takže skutečné maximum je ~5,3°.

### Typografie

Nadpisy **Fraunces** — old-style serif s měkkými, trochu nepravidelnými tahy;
působí ručně, ne kaligraficky. Text **Inter**. Oba lokálně, žádný request na
Google Fonts (a tedy ani žádné sledování hostů).

### Mapka ubytování

V sekci Ubytování je malá mapka okolí — poloha Himmelreichu a pár možností,
kde spát, když se na chalupu nevejdete. Není to vložený Google/Mapy.cz iframe
(to by táhlo externí požadavky a sledování, čemuž se zbytek webu vyhýbá), ale
vlastní SVG generované z reálných GPS souřadnic.

`tools/mapa.py` promítne souřadnice jednoduchou rovnoběžkovou projekcí (na
necelý kilometr napříč je zkreslení oproti pořádné kartografii zanedbatelné)
a plátno spočítá z reálného rozpětí bodů, ne z pevného čísla — jinak se při
přidání vzdálenějšího bodu okraj mapy tiše usekne.

```bash
python tools/mapa.py                    # jen vypíše vzdálenosti od Himmelreichu
python tools/mapa.py /tmp/mapka.svg     # a zapíše i SVG
```

**Plné kolečko = střecha nad hlavou** (chalupa, hotel, kemp). **Prázdné
kolečko = bivak** — spací pytel a nebe nad hlavou, žádná budova. Barvy
používají existující proměnné z palety (`var(--chrpa)` pro hotel), kemp má
vlastní `--kemp: #8F740C` — `var(--pryskyrnik)` by nešlo použít, ta má na
světlém pozadí kontrast jen 1.75:1 (viz sekce Paleta výš).

Mapka je vložená **přímo v `index.html`**, ne jako samostatný `<img>` soubor
jako louka nebo vzor pozadí — používá `var(--text)` a spol. přímo, takže se
motivu přizpůsobí bez JS a bez druhého generování. Při úpravě souřadnic v
`tools/mapa.py` je potřeba vygenerované `<svg class="mapka">…</svg>` ručně
nahradit v `index.html`.

Přidat další bod: řádek do `BODY` na začátku skriptu (jméno, lat, lon,
kategorie). Konfliktní popisek u blízkých bodů (jako Himmelreich a Kemp Pod
Císařem, jen 99 m od sebe) se doladí v `POPISEK_PREPIS`.

**Terén** (`SILNICE`, `RYBNIK_STRED`/`RYBNIK_R`, `LES_STRED`/`LES_R` v horní
části skriptu) na rozdíl od bodů v `BODY` **nemá přesné souřadnice**. Je
odhadnutý podle
poměrů na screenshotech z Mapy.cz — dost přesně na to, aby mapa přestala
být prázdný čtverec s tečkami, ne dost přesně na navigaci. Stezky ke třem
bivakům jsou stylizované zvlněné křivky od osady k cíli, ne trasované GPS
stopy — skutečné cesty lesem vedou jinudy a klikatěji.

Lesní/skalní zóna schválně pokrývá jen Německý bivak a Sovu (oba mají
odkaz na horosvaz.cz, jsou to skutečné lezecké věže ve stejném skalním
pásmu). Lesní jesličky leží na opačné, východní straně a do zóny
nepatří — kdyby zóna měla obsáhnout všechny tři body, musela by se
natáhnout přes celou mapu a přestala by cokoli rozlišovat.

Řídicí bod zvlněné stezky se posouvá vodorovně na stranu, kde cíl
skutečně leží (ne kolmo na spojnici) — kolmý posun má náhodnou stranu,
a když náhodou vyjde směrem k silnici, stezka se s ní na kus cesty táhne
souběžně a splývá s ní. Přesně to se stalo při prvním pokusu se stezkou
k Sově.

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
