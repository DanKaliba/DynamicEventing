# Svatební web

Statická jednostránka. Žádný build, žádný framework, žádný externí request —
otevřeš `index.html` v prohlížeči a funguje.

```
index.html           všechen obsah, sekce jsou oddělené komentáři
assets/style.css     paleta, theming (světlý/tmavý), layout
assets/gallery.js    ← seznam fotek, jediné místo k editaci galerie
assets/main.js       odpočet, lightbox, přepínač motivu, navigace
assets/fonts/        Inter (variabilní woff2, lokální)
assets/img/          fotky
```

---

## 1. Doplnit obsah

Všechno, co je potřeba vyplnit, je v `index.html` v hranatých závorkách velkými
písmeny. Najdeš to takhle:

```bash
grep -n "\[[A-ZÁ-Ž]" index.html
```

Jde o: jména, datum, čas, adresy, odkazy na mapy, telefony, e-maily,
číslo účtu a detaily ubytování. Text sekcí (proč přijet, dress code, FAQ) je
napsaný — přepiš ho podle sebe.

Odpočet se řídí atributem `data-date` u `<div class="countdown">` — formát
`RRRR-MM-DDTHH:MM`, čas obřadu. Po svatbě se odpočet sám schová.

## 2. Přidat fotky

1. Zmenši je — šířka max 2000 px, JPEG kvalita ~80, ideálně pod 500 kB/kus.
2. Nahraj do `assets/img/`. Názvy bez diakritiky a mezer: `obrad-01.jpg`.
3. Přidej řádek do `assets/gallery.js`:

```js
window.GALLERY = [
  { src: 'assets/img/obrad-01.jpg', alt: 'Obřad v zahradě' },
];
```

`alt` je krátký popis fotky — potřebný pro odečítače obrazovky.
Dokud je seznam prázdný, galerie ukazuje hlášku „Fotky připravujeme".

## 3. Zveřejnit přes GitHub Pages

**Jednorázové nastavení:**

1. Repo musí být **veřejné** — GitHub Pages zdarma na privátním nejede.
   `Settings → General → Danger Zone → Change visibility → Public`
2. `Settings → Pages`
3. **Source:** `Deploy from a branch`
4. **Branch:** `main`, složka `/ (root)` → **Save**
5. Za pár minut běží na `https://<uživatel>.github.io/<repo>/`

**Každá další změna:**

```bash
git add -A
git commit -m "Doplněno ubytování"
git push
```

Za 1–2 minuty je to venku. Stav nasazení vidíš v záložce **Actions**.

### Soukromí

Web je veřejný — kdokoli s odkazem ho uvidí. `<meta name="robots" content="noindex">`
v hlavičce brání tomu, aby se stránka dostala do vyhledávačů, ale není to zámek.
**Nedávej sem nic, co nechceš mít veřejné** — čísla účtů a telefony zvaž.

### Vlastní doména

Když budeš chtít třeba `nasesvatba.cz`:

1. U registrátora nastav `CNAME` na `<uživatel>.github.io`
2. `Settings → Pages → Custom domain` → zadej doménu → Save
3. Počkej, až se zaškrtne **Enforce HTTPS**

## Poznámka k téhle složce

`index-cz.html` a `workflow-demo-cz.html` jsou interní Košík BI prezentace,
které tu ležely předtím. Jsou v `.gitignore`, aby se nedostaly do veřejného
repa. Nemaž ty řádky.
