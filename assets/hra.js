/* ==========================================================================
   Hra: Cesta na vrchol

   Svislá plošinovka na konci stránky. Daník šplhá na horu, Ája jde po
   jeho stopě (přehrává jeho pohyb s malým zpožděním). Cestou jsou
   milníky ze společného života (CHECKPOINTY s datem a krátkou scénkou,
   zub s úkolem, minihra na kole); na vrcholu je ve vrcholové schránce
   prsten.

   Minihra na kole (sekce „Kolo“) se hraje ve stejném plátně, ale jako
   vodorovná jízda — žádná patra navíc. Po dojetí se hra vrátí na
   plošinu, kde začala.

   Logické rozlišení je 160 × 144 px, na obrazovce se zvětšuje celým
   násobkem, aby pixely zůstaly ostré. Texty (bubliny, titulky, panely)
   jsou HTML nad plátnem — kvůli diakritice a přepínání jazyka.

   Plošiny jsou jednosměrné: zespodu se jimi proskočí, shora se na ně
   doskočí. Plošina s `duch` je průhledná, dokud se neodemkne (setkání,
   zub) — tím se hlídá pořadí milníků.

   Na dotykových zařízeních se hra nespouští (index.html tam ukáže větu,
   ať si ji zahrajou na počítači). Sprity jsou v assets/hra-sprity.js.
   ========================================================================== */

(function () {
  'use strict';

  var okno = document.getElementById('hra-okno');
  if (!okno) return;
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  // Bez spritů nebo canvasu se hra nespustí — ať tam aspoň není prázdno.
  if (!window.HRA_SPRITY || !document.createElement('canvas').getContext) {
    var chyba = document.querySelector('.hra-chyba');
    if (chyba) chyba.hidden = false;
    return;
  }

  var SPR = window.HRA_SPRITY;
  var platno = okno.querySelector('canvas');
  var ctx = platno.getContext('2d');
  var panel = okno.querySelector('.hra-panel');
  var bublinaEl = okno.querySelector('.hra-bublina');
  var hudEl = okno.querySelector('.hra-hud');
  var titulekEl = okno.querySelector('.hra-titulek');

  var W = 160, H = 144;
  var ZEM = 664;                  // y louky dole
  var SVET_V = ZEM + 20;
  var KROK = 1 / 120;

  // Fyzika (px, s). Výška skoku ≈ SKOK² / (2·GRAV) ≈ 39 px, plošiny jsou 26 px od sebe.
  var GRAV = 900, SKOK = 265, RYCHLOST = 68, MAX_PAD = 320;
  var KOYOT = 0.08, BUFFER = 0.12;
  var ZKRACENI = 0.45;   // krátký stisk: rychlost skoku se zkrátí na tolik
  var ODSTUP = 14;   // jak daleko za Daníkem Ája drží

  // ---------- Texty ----------
  var TEXTY = {
    ahojAja:   { cs: 'Ahoj!', en: 'Hi!' },
    ahojDan:   { cs: 'Ahoj…', en: 'Hi…' },
    spolu:     { cs: 'Spolu nahoru', en: 'Up together' },
    chodimeTit:  { cs: 'Chodíme spolu', en: 'We\'re dating' },
    chodimeDat:  { cs: '24. 10. 2024', en: '24 Oct 2024' },
    chodimeAja:  { cs: 'Tak spolu chodíme?', en: 'So… are we dating?' },
    chodimeDan:  { cs: 'Chodíme.', en: 'We are.' },
    bydleniTit:  { cs: 'Společné bydlení', en: 'Moving in together' },
    bydleniDat:  { cs: '15. 1. 2025', en: '15 Jan 2025' },
    klice:       { cs: 'Tady máš klíče.', en: 'Here are your keys.' },
    doma:        { cs: 'Konečně spolu doma!', en: 'Home together at last!' },
    zubDat:      { cs: 'březen–duben 2025', en: 'March–April 2025' },
    zlinTit:     { cs: 'Konec studií ve Zlíně', en: 'Graduating in Zlín' },
    zlinDat:     { cs: '20. 5. 2025', en: '20 May 2025' },
    dostudovano: { cs: 'Dostudováno!', en: 'Graduated!' },
    gratuluju:   { cs: 'Gratuluju!', en: 'Congrats!' },
    koloTit:     { cs: 'Nové silničky', en: 'New road bikes' },
    doHaku:      { cs: 'Jeď za mnou v háku!', en: 'Ride right behind me!' },
    slapej:      { cs: 'Šlapej střídavě ← → a drž Áju v zeleném', en: 'Pedal by alternating ← → and keep Ája in the green' },
    vHaku:       { cs: 'Ája v háku', en: 'Ája is drafting' },
    odpadla:     { cs: 'Ája odpadla — zvolni', en: 'Ája dropped — ease off' },
    vitr:        { cs: 'protivítr!', en: 'headwind!' },
    pockej:      { cs: 'Počkej na mě!', en: 'Wait for me!' },
    pridej:      { cs: 'Přidej!', en: 'Faster!' },
    vCili:       { cs: 'V cíli', en: 'Finished' },
    podilHaku:   { cs: 'v háku', en: 'drafting' },
    jizda:       { cs: 'To byla jízda!', en: 'What a ride!' },
    lezeniTit:   { cs: 'Lezení na Sicílii', en: 'Climbing in Sicily' },
    lezeniDat:   { cs: 'únor 2026', en: 'February 2026' },
    kdoLeze:     { cs: 'Kdo poleze? ← Ája · Daník → · potvrď mezerníkem', en: 'Who leads? ← Ája · Daník → · confirm with space' },
    lezciInfo:   { cs: 'Ája je rychlejší, ale dřív jí dojde. Daník je pomalejší, ale vydrží déle.', en: 'Ája is faster but tires sooner. Daník is slower but lasts longer.' },
    znovuLezt:   { cs: 'Mezerník: lézt znovu · ↑: dál na horu', en: 'Space: climb again · ↑: continue up' },
    znovuJet:    { cs: 'Mezerník: jet znovu · ↑: dál na horu', en: 'Space: ride again · ↑: continue up' },
    jistim:      { cs: 'Jistím, lez!', en: 'On belay, climb!' },
    lezNapoveda: { cs: 'Šipkou ← ↑ → na zvýrazněný chyt', en: 'Arrow ← ↑ → to the highlighted hold' },
    cvakni:      { cs: 'Nýt! Zacvakni expresku mezerníkem', en: 'Bolt! Clip the quickdraw with space' },
    mamTe:       { cs: 'Mám tě!', en: 'Got you!' },
    dobirej:     { cs: 'Dobírej!', en: 'Take!' },
    spoustej:    { cs: 'Spouštěj!', en: 'Lower me!' },
    krasnaCesta: { cs: 'Krásná cesta!', en: 'Beautiful route!' },
    dolezeno:    { cs: 'Dolezeno', en: 'Topped out' },
    zaKoho:      { cs: 'Za koho hraješ? ← Daník · Ája → · potvrď mezerníkem', en: 'Who do you play? ← Daník · Ája → · confirm with space' },
    stopaVolba:  { cs: 'Ten druhý půjde po tvé stopě: kam skočíš ty, skočí i on. Hlídej jen sebe.', en: 'The other one follows your steps: wherever you jump, they jump too. Just watch yourself.' },
    stopaDan:    { cs: 'Ája jde po tvé stopě: kam skočíš ty, skočí i ona. Hlídej jen sebe.', en: 'Ája follows your steps: wherever you jump, she jumps too. Just watch yourself.' },
    stopaAja:    { cs: 'Daník jde po tvé stopě: kam skočíš ty, skočí i on. Hlídej jen sebe.', en: 'Daník follows your steps: wherever you jump, he jumps too. Just watch yourself.' },
    tedDan:      { cs: 'Ája leží v posteli, teď hraješ za Daníka', en: 'Ája is in bed, now you play as Daník' },
    zaseAja:     { cs: 'Ája je zdravá, zase hraješ za ni', en: 'Ája is better, you play as her again' },
    zubTitul:  { cs: 'Bolavý zub', en: 'The toothache' },
    au:        { cs: 'Au! Bolí mě zub…', en: 'Ouch! My tooth hurts…' },
    zubUkol:   { cs: 'Přines Áje prášek, čaj a led.', en: 'Bring Ája a pill, tea and ice.' },
    prasek:    { cs: 'prášek', en: 'pill' },
    caj:       { cs: 'čaj', en: 'tea' },
    led:       { cs: 'led', en: 'ice' },
    proAju:    { cs: 'Pro Áju', en: 'For Ája' },
    jesteNe:   { cs: 'Ještě něco chybí…', en: 'Something\'s still missing…' },
    diky:      { cs: 'Už je to lepší. Díky!', en: 'Much better. Thanks!' },
    vrcholTit: { cs: 'Vrchol', en: 'The summit' },
    knizka:    { cs: 'Zapíšem se do knížky…', en: 'Let\'s sign the summit book…' },
    otazka:    { cs: 'Ájo, vezmeš si mě?', en: 'Ája, will you marry me?' },
    ano:       { cs: 'Ano!', en: 'Yes!' }
  };
  function dvoj(k) {
    return '<span class="jazyk-cs">' + TEXTY[k].cs + '</span><span class="jazyk-en">' + TEXTY[k].en + '</span>';
  }
  // Čas minihry jako m:ss.
  function casMmSs(sekundy) {
    var s = Math.round(sekundy);
    return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
  }

  // ---------- Úroveň ----------
  // y roste dolů, 0 = nebe nad vrcholem, SVET_V = pod zemí.
  // duch: plošina je jen obrys, dokud se daný milník nesplní.
  var PLOSINY = [
    { x: 0, y: 664, w: 160, zem: true },
    { x: 100, y: 636, w: 36, duch: 'setkani' },
    { x: 56, y: 610, w: 30 },
    { x: 104, y: 584, w: 40, id: 'chodime' },    // 24. 10. 2024
    { x: 70, y: 558, w: 24 },
    { x: 112, y: 532, w: 34, id: 'bydleni' },    // 15. 1. 2025
    { x: 74, y: 506, w: 26 },
    { x: 30, y: 480, w: 30 },
    // --- milník: bolavý zub ---
    { x: 36, y: 454, w: 84, id: 'zub' },
    { x: 128, y: 478, w: 28 },               // prášek
    { x: 4, y: 426, w: 22 },                 // čaj
    { x: 132, y: 430, w: 24 },               // led
    { x: 70, y: 428, w: 24, duch: 'zub' },
    { x: 36, y: 404, w: 26, duch: 'zub' },
    { x: 80, y: 378, w: 28, duch: 'zub' },
    // --- dál nahoru ---
    { x: 112, y: 352, w: 30 },
    { x: 66, y: 326, w: 26 },
    { x: 22, y: 300, w: 30, id: 'zlin' },        // 20. 5. 2025
    { x: 64, y: 274, w: 24 },
    { x: 30, y: 248, w: 28, id: 'kolo' },        // minihra na kole
    { x: 72, y: 222, w: 24 },
    { x: 110, y: 196, w: 26 },
    { x: 128, y: 170, w: 28, id: 'lezeni' },     // minihra: lezení na Sicílii
    { x: 90, y: 144, w: 24 },
    { x: 56, y: 118, w: 24 },
    { x: 28, y: 92, w: 104, id: 'vrchol' }
  ];
  var plosina = {};
  PLOSINY.forEach(function (p) { if (p.id) plosina[p.id] = p; });

  var VECI_ZUB = [
    { id: 'prasek', x: 138, y: 478 - 10 },
    { id: 'caj', x: 10, y: 426 - 10 },
    { id: 'led', x: 140, y: 430 - 10 }
  ];
  var SCHRANKA = { x: 108, y: 92 - 13, w: 9, h: 13 };
  var KRIZ_X = 44;

  // Checkpointy: cedulka na plošině, a když na ni Ája dojde, titulek
  // s datem a scénka (funkce níž v sekci Milníky). Pořadí = zdola nahoru.
  // Nový checkpoint: id na plošinu v PLOSINY, řádek sem, texty do TEXTY.
  var CHECKPOINTY = [
    { id: 'chodime', ikona: 'srdce', titul: 'chodimeTit', datum: 'chodimeDat', scena: scenaChodime },
    { id: 'bydleni', ikona: 'dum', titul: 'bydleniTit', datum: 'bydleniDat', scena: scenaBydleni },
    { id: 'zlin', ikona: 'cepice', titul: 'zlinTit', datum: 'zlinDat', scena: scenaZlin }
  ];
  // Pořadí milníků pro ?hra=… (ladění) — začne se o patro níž.
  var PORADI = ['chodime', 'bydleni', 'zub', 'zlin', 'kolo', 'lezeni', 'vrchol'];

  // ---------- Stav ----------
  // dan, aja = postavy (mluví, kreslí se svými sprity). hrac = ta z nich,
  // kterou hráč ovládá; druhy = ta, která jde po hráčově stopě. Na začátku
  // si hráč vybere; u zubu se při hře za Áju role na chvíli prohodí.
  var dan, aja, hrac, druhy, stopa, odemceno, veci, castice, scena, kamY, cas;
  var zvoleno = 'dan';          // za koho hráč hraje (vybral si na začátku)
  var volba = null;             // výběr postavy na začátku: { vyber }, jinak null
  var infoDo = 0;               // do kdy svítí nápověda o stopě (čas hry)
  var hotovo;                   // splněné checkpointy a minihra, podle id
  var jizda = null;             // běžící minihra na kole, jinak null
  var stena = null;             // běžící minihra na lezení, jinak null
  // Checkpoint = nejvyšší milník, na který Daník doskočil. Kdo spadne víc
  // než PROPAD pod něj, vrátí se na něj (o patro níž ještě ne — u zubu se
  // pro prášek chodí o patro dolů).
  var KONTROLNI = ['chodime', 'bydleni', 'zub', 'zlin', 'kolo', 'lezeni'];
  var PROPAD = 30;
  var kontrolniBod;
  var klavesy = { vlevo: false, vpravo: false, skok: false };
  var bufferSkoku = 0;
  var bublina = { kdo: null, zbyva: 0 };
  var rezim = 'uvod';           // uvod | hra | pauza | konec
  var schrankaOtevrena = false, prstenY = null, klek = false;

  function novaHra() {
    dan = { x: 18, y: ZEM - 18, w: 6, h: 18, vx: 0, vy: 0, smer: 1, naZemi: true, koyot: 0, krok: 0, stav: 'ceka', anim: 'stoji' };
    aja = { x: 128, y: ZEM - 15, w: 6, h: 15, vx: 0, vy: 0, smer: -1, naZemi: true, koyot: 0, krok: 0, stav: 'ceka', anim: 'stoji' };
    zvolPostavu('dan');
    volba = null;
    infoDo = 0;
    stopa = [];
    odemceno = {};
    veci = VECI_ZUB.map(function (v) { return { id: v.id, x: v.x, y: v.y, mam: false }; });
    castice = [];
    scena = null;
    kamY = SVET_V - H;
    cas = 0;
    bufferSkoku = 0;
    schrankaOtevrena = false; prstenY = null; klek = false;
    hotovo = {};
    kontrolniBod = PLOSINY[0];
    jizda = null;
    stena = null;
    PLOSINY.forEach(function (p) { p.objev = p.duch ? 0 : 1; });
    zub = 'ceka';
    schovejBublinu();
    hud('');
    preskocNaMilnik();
  }

  // Ladění: ?hra=<milník z PORADI> v adrese začne o patro pod ním,
  // všechno předchozí je splněné.
  function preskocNaMilnik() {
    var m = /[?&]hra=(\w+)/.exec(location.search);
    var poradi = m ? PORADI.indexOf(m[1]) : -1;
    if (/[?&]za=aja/.test(location.search)) zvolPostavu('aja');
    if (poradi < 0) return;
    odemkni('setkani');
    PORADI.slice(0, poradi).forEach(function (id) {
      hotovo[id] = true;
      if (KONTROLNI.indexOf(id) >= 0) kontrolniBod = plosina[id];
    });
    if (poradi > PORADI.indexOf('zub')) { odemkni('zub'); zub = 'hotovo'; }
    var p = PLOSINY[PLOSINY.indexOf(plosina[m[1]]) - 1];
    PLOSINY.forEach(function (pl) { if (pevna(pl)) pl.objev = 1; });
    hrac.x = p.x + p.w / 2; hrac.y = p.y - hrac.h;
    druhy.x = p.x + 1; druhy.y = p.y - druhy.h; druhy.stav = 'sleduje';
    kamY = Math.max(0, Math.min(SVET_V - H, hrac.y - H * 0.6));
  }
  var zub = 'ceka';   // ceka | bolest | hotovo

  // Za koho se hraje: ta postava je hrac, ta druhá jde po jeho stopě.
  function zvolPostavu(kdo) {
    zvoleno = kdo;
    hrac = kdo === 'aja' ? aja : dan;
    druhy = kdo === 'aja' ? dan : aja;
  }

  // Výběr na začátku: oba stojí na louce každý na své straně.
  function zacniVolbu() {
    volba = { vyber: null };
    hud(dvoj('zaKoho') + '<br>' + dvoj('stopaVolba'));
  }
  function potvrdVolbu() {
    zvolPostavu(volba.vyber);
    volba = null;
    hud('');
  }

  // Prohodí, koho hráč ovládá (u zubu: Ája leží, hraje se za Daníka).
  // Těla zůstávají, kde jsou; nový druhý začne chodit po stopě od sebe.
  function prohodRole() {
    var byvaly = hrac;
    hrac = druhy;
    druhy = byvaly;
    hrac.vx = 0; hrac.vy = 0; hrac.koyot = 0;
    druhy.stav = 'sleduje'; druhy.naZemi = true; druhy.anim = 'stoji';
    stopa = [{ x: druhy.x, y: druhy.y, g: true }];
  }

  function pevna(p) { return !p.duch || odemceno[p.duch]; }
  function odemkni(klic) { odemceno[klic] = true; }

  // ---------- HTML vrstvy ----------
  function rekni(kdo, klic, trvani) {
    bublinaEl.innerHTML = dvoj(klic);
    bublinaEl.hidden = false;
    bublina.kdo = kdo;
    bublina.zbyva = trvani || 2.4;
  }
  function schovejBublinu() { bublinaEl.hidden = true; bublina.kdo = null; }

  function hud(html) {
    hudEl.innerHTML = html;
    hudEl.hidden = !html;
  }
  function hudZub() {
    var mam = veci.filter(function (v) { return v.mam; }).length;
    hud((zvoleno === 'aja' ? dvoj('tedDan') + '<br>' : '') + dvoj('proAju') + ': ' + mam + '/3 &nbsp;' + veci.map(function (v) {
      return '<span class="' + (v.mam ? 'mam' : 'nemam') + '">' + dvoj(v.id) + '</span>';
    }).join(' · '));
  }

  var titulekCas = null;
  function titulek(klic, datum) {
    titulekEl.innerHTML = (datum ? '<small>' + dvoj(datum) + '</small>' : '') + dvoj(klic);
    titulekEl.classList.add('videt');
    clearTimeout(titulekCas);
    titulekCas = setTimeout(function () { titulekEl.classList.remove('videt'); }, 2600);
  }

  function ukazPanel(typ) {
    panel.setAttribute('data-typ', typ);
    panel.hidden = false;
  }

  // ---------- Scény (posloupnost kroků v čase) ----------
  function spustScenu(kroky) { scena = { t: 0, i: 0, kroky: kroky }; }
  function aktualizujScenu(dt) {
    if (!scena) return;
    var s = scena;
    s.t += dt;
    while (scena === s && s.i < s.kroky.length && s.kroky[s.i][0] <= s.t) s.kroky[s.i++][1]();
    if (scena === s && s.i >= s.kroky.length) scena = null;
  }

  function srdicka(x, y, n) {
    for (var i = 0; i < n; i++) {
      castice.push({ x: x + (Math.random() - 0.5) * 10, y: y, vx: (Math.random() - 0.5) * 18,
        vy: -20 - Math.random() * 25, zivot: 1.4 + Math.random() * 0.8, druh: 'srdce' });
    }
  }
  function jiskry(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 25;
      castice.push({ x: x, y: y, vx: Math.cos(a) * r, vy: Math.sin(a) * r, zivot: 0.5 + Math.random() * 0.4, druh: 'jiskra' });
    }
  }

  // ---------- Milníky ----------
  function setkani() {
    aja.smer = -1; dan.smer = 1;
    spustScenu([
      [0, function () { rekni(aja, 'ahojAja', 1.1); }],
      [1.1, function () { rekni(dan, 'ahojDan', 1.1); }],
      [1.4, function () { srdicka(aja.x + 3, aja.y, 3); srdicka(dan.x + 3, dan.y, 3); }],
      [2.3, function () {
        druhy.stav = 'sleduje';
        odemkni('setkani');
        titulek('spolu');
        hud(dvoj(zvoleno === 'aja' ? 'stopaAja' : 'stopaDan'));
        infoDo = cas + 7;
      }]
    ]);
  }

  // Checkpointy: Ája došla na plošinu. Daník mezitím může být o kus dál,
  // bubliny a srdíčka se kreslí nad každým zvlášť.
  function scenaChodime() {
    spustScenu([
      [0.2, function () { rekni(aja, 'chodimeAja', 1.6); }],
      [1.8, function () { rekni(dan, 'chodimeDan', 1.3); srdicka(aja.x + 3, aja.y, 5); srdicka(dan.x + 3, dan.y, 5); }],
      [3.1, function () {}]
    ]);
  }

  function scenaBydleni() {
    spustScenu([
      [0.2, function () { rekni(dan, 'klice', 1.5); hod('klic', dan, aja); }],
      [1.7, function () { rekni(aja, 'doma', 1.6); srdicka(aja.x + 3, aja.y, 6); }],
      [3.3, function () {}]
    ]);
  }

  function scenaZlin() {
    spustScenu([
      [0.2, function () {
        rekni(aja, 'dostudovano', 1.6);
        castice.push({ x: aja.x, y: aja.y - 4, vx: 6, vy: -70, zivot: 1.7, druh: 'cepice', tiz: 80 });
        jiskry(aja.x + 3, aja.y, 10);
      }],
      [1.8, function () { rekni(dan, 'gratuluju', 1.4); srdicka(aja.x + 3, aja.y, 5); }],
      [3.2, function () {}]
    ]);
  }

  // Věc přeletí obloukem od jednoho k druhému (klíče).
  function hod(druh, od, k) {
    var t = 0.9, dx = (k.x - od.x), dy = (k.y - od.y);
    castice.push({ x: od.x + 3, y: od.y + 4, vx: dx / t, vy: dy / t - 40 * t, zivot: t, druh: druh, tiz: 80 });
  }

  function zacatekZubu() {
    zub = 'bolest';
    // Hrálo se za Áju: teď leží, hráč přebírá Daníka.
    if (hrac === aja) prohodRole();
    aja.stav = 'bolest';
    aja.x = POSTEL.x + 2; aja.y = plosina.zub.y - aja.h; aja.naZemi = true;
    stopa = [];
    infoDo = 0;
    titulek('zubTitul', 'zubDat');
    spustScenu([
      [0.3, function () { rekni(aja, 'au', 2.2); }],
      [2.6, function () { rekni(aja, 'zubUkol', 3); hudZub(); }]
    ]);
  }

  function predejVeci() {
    if (!veci.every(function (v) { return v.mam; })) {
      if (!bublina.kdo) rekni(aja, 'jesteNe', 1.6);
      return;
    }
    zub = 'hotovo';
    hud('');
    spustScenu([
      [0, function () { rekni(aja, 'diky', 2); srdicka(aja.x + 3, aja.y, 4); }],
      [0.6, function () { odemkni('zub'); }],
      [1.6, function () {
        // Ája vstane z postele. Hrálo se za ni → zase ji ovládá hráč.
        aja.stav = 'sleduje';
        aja.naZemi = true;
        if (zvoleno === 'aja') {
          prohodRole();
          hud(dvoj('zaseAja'));
          infoDo = cas + 3;
        }
        stopa = [{ x: druhy.x, y: druhy.y, g: true }];
      }]
    ]);
  }

  function zadost() {
    titulek('vrcholTit');
    hrac.vx = 0;
    // Druhý se postaví k hráči (mohl zůstat o kus níž).
    var ox = hrac.x - ODSTUP;
    if (ox < plosina.vrchol.x + 2) ox = hrac.x + ODSTUP;
    druhy.x = ox; druhy.y = plosina.vrchol.y - druhy.h;
    dan.stav = aja.stav = 'scena'; dan.anim = aja.anim = 'stoji';
    aja.smer = aja.x < dan.x ? 1 : -1;
    dan.smer = -aja.smer;
    spustScenu([
      [0.2, function () { rekni(dan, 'knizka', 1.6); }],
      [1.4, function () { schrankaOtevrena = true; jiskry(SCHRANKA.x + 4, SCHRANKA.y + 3, 10); prstenY = SCHRANKA.y; }],
      [2.6, function () { klek = true; rekni(dan, 'otazka', 2.8); }],
      [5.6, function () { rekni(aja, 'ano', 2.2); srdicka(aja.x + 3, aja.y, 12); srdicka(dan.x + 3, dan.y + 4, 8); aja.anim = 'skok'; }],
      [6.0, function () { aja.anim = 'stoji'; }],
      [6.6, function () { srdicka((aja.x + dan.x) / 2 + 3, aja.y, 10); }],
      [8.4, function () { rezim = 'konec'; ukazPanel('konec'); }],
      [11, zastav]   // srdíčka doletí, pak smyčka spí
    ]);
  }

  // ---------- Aktualizace ----------
  function priblizit(a, b, d) { return a < b ? Math.min(a + d, b) : Math.max(a - d, b); }
  function prekryv(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  // Daník (a Ája, pokud jde s ním) zpátky na poslední checkpoint.
  // Ája, kterou zrovna bolí zub, zůstává sedět, kde je — to je ta plošina.
  function zpetNaCheckpoint() {
    var p = kontrolniBod;
    hrac.x = Math.round(p.x + p.w / 2 - hrac.w / 2); hrac.y = p.y - hrac.h;
    hrac.vx = hrac.vy = 0; hrac.naZemi = p;
    jiskry(hrac.x + 3, hrac.y + 8, 10);
    if (druhy.stav === 'sleduje') {
      druhy.x = hrac.x - ODSTUP >= p.x ? hrac.x - ODSTUP : hrac.x + ODSTUP;
      druhy.y = p.y - druhy.h; druhy.naZemi = true; druhy.anim = 'stoji';
      stopa = [{ x: druhy.x, y: druhy.y, g: true }];
    }
  }

  // Konec minihry (kolo, lezení), zpátky na horu: oba na plošině, kde
  // minihra začala. Stojí vlevo těsně u sebe, ať je vpravo vidět vybavení.
  function navratNa(p) {
    jizda = null;
    stena = null;
    castice = [];
    hud('');
    schovejBublinu();
    bufferSkoku = 0;
    druhy.x = p.x; druhy.y = p.y - druhy.h; druhy.smer = 1;
    hrac.x = p.x + 7; hrac.y = p.y - hrac.h; hrac.vx = hrac.vy = 0; hrac.smer = -1;
    druhy.stav = 'sleduje'; druhy.naZemi = true; druhy.anim = 'stoji';
    stopa = [{ x: druhy.x, y: druhy.y, g: true }];
  }

  function plosinaPod(e) {
    for (var i = 0; i < PLOSINY.length; i++) {
      var p = PLOSINY[i];
      if (pevna(p) && Math.abs(e.y + e.h - p.y) < 0.5 && e.x + e.w > p.x && e.x < p.x + p.w) return p;
    }
    return null;
  }
  // Postel na plošině se zubem; věci se Áje nosí k ní.
  var POSTEL = { x: plosina.zub.x + 12, w: 16 };
  var U_POSTELE = { x: POSTEL.x - 4, y: plosina.zub.y - 12, w: POSTEL.w + 8, h: 12 };
  // Ke schránce stačí dojít, nemusí se do ní trefit pixel po pixelu.
  var U_SCHRANKY = { x: SCHRANKA.x - 6, y: SCHRANKA.y, w: SCHRANKA.w + 12, h: SCHRANKA.h };

  function aktualizuj(dt) {
    cas += dt;
    aktualizujScenu(dt);
    if (jizda) aktualizujJizdu(dt);
    else if (stena) aktualizujStenu(dt);
    else aktualizujLezeni(dt);
    aktualizujCastice(dt);
  }

  function aktualizujLezeni(dt) {
    var ovladani = !scena && !volba && rezim === 'hra';
    if (infoDo && cas > infoDo) { infoDo = 0; hud(''); }

    // Daník
    var smerX = ovladani ? (klavesy.vpravo ? 1 : 0) - (klavesy.vlevo ? 1 : 0) : 0;
    hrac.vx = priblizit(hrac.vx, smerX * RYCHLOST, (hrac.naZemi ? 900 : 600) * dt);
    if (smerX) hrac.smer = smerX;

    bufferSkoku -= dt;
    hrac.koyot = hrac.naZemi ? KOYOT : hrac.koyot - dt;
    if (ovladani && bufferSkoku > 0 && hrac.koyot > 0) {
      // Skok z bufferu: když už mezerník pustil, je to krátký stisk = nižší skok.
      hrac.vy = klavesy.skok ? -SKOK : -SKOK * ZKRACENI;
      hrac.koyot = 0; bufferSkoku = 0;
    }

    hrac.vy = Math.min(hrac.vy + GRAV * dt, MAX_PAD);
    hrac.x = Math.max(0, Math.min(W - hrac.w, hrac.x + hrac.vx * dt));
    var predNohy = hrac.y + hrac.h;
    hrac.y += hrac.vy * dt;
    var nohy = hrac.y + hrac.h;
    hrac.naZemi = null;
    if (hrac.vy >= 0) {
      for (var i = 0; i < PLOSINY.length; i++) {
        var p = PLOSINY[i];
        if (!pevna(p)) continue;
        if (predNohy <= p.y + 0.01 && nohy >= p.y && hrac.x + hrac.w > p.x && hrac.x < p.x + p.w) {
          hrac.y = p.y - hrac.h; hrac.vy = 0; hrac.naZemi = p;
          break;
        }
      }
    }
    hrac.krok += Math.abs(hrac.vx) * dt;

    // Checkpointy: doskočil výš → nový; propadl se hluboko pod → zpátky.
    var na = hrac.naZemi;
    if (na && KONTROLNI.indexOf(na.id) >= 0 && na.y < kontrolniBod.y) kontrolniBod = na;
    if (!scena && hrac.y + hrac.h > kontrolniBod.y + PROPAD) zpetNaCheckpoint();

    // Ája
    if (druhy.stav === 'ceka' && !scena && hrac.naZemi && hrac.naZemi.zem && Math.abs(hrac.x - druhy.x) < 16) setkani();

    if (druhy.stav === 'sleduje') {
      var posl = stopa[stopa.length - 1];
      var bod = { x: hrac.x, y: hrac.y + hrac.h - druhy.h, g: !!hrac.naZemi };
      if (!posl || posl.x !== bod.x || posl.y !== bod.y) stopa.push(bod);

      // Na zemi nevkročí na bod blíž než ODSTUP od Daníka a k bodu, který je
      // dál než jeden krok (třeba na začátku stopy), dojde pěšky. Ve vzduchu
      // skok vždycky dokončí. Když moc zaostává, jde dvojnásobnou rychlostí.
      var kolik = stopa.length > 50 ? 2 : 1, posun = 0;
      var pesky = RYCHLOST * 1.3 * KROK;
      for (var n = 0; n < kolik && stopa.length; n++) {
        var b = stopa[0];
        if (druhy.naZemi && b.g) {
          var bx = hrac.x - b.x, by = (hrac.y + hrac.h) - (b.y + druhy.h);
          if (stopa.length <= 50 && bx * bx + by * by < ODSTUP * ODSTUP) break;
          if (Math.abs(b.y - druhy.y) < 0.5 && Math.abs(b.x - druhy.x) > pesky) {
            druhy.smer = b.x > druhy.x ? 1 : -1;
            druhy.x += druhy.smer * pesky;
            posun += pesky;
            continue;
          }
        }
        stopa.shift();
        if (b.x !== druhy.x) druhy.smer = b.x > druhy.x ? 1 : -1;
        posun += Math.abs(b.x - druhy.x);
        druhy.x = b.x; druhy.y = b.y;
        druhy.naZemi = b.g;
      }
      // Doskočila Daníkovi přímo pod nohy (skákal kolmo nahoru) — poodstoupí.
      var vedle = druhy.x - hrac.x;
      if (!posun && druhy.naZemi && hrac.naZemi && Math.abs(vedle) < ODSTUP - 2 &&
          Math.abs(druhy.y + druhy.h - hrac.y - hrac.h) < 0.5) {
        var pod = plosinaPod(druhy);
        var kam = vedle ? (vedle > 0 ? 1 : -1) : -hrac.smer;
        for (var pokus = 0; pokus < 2; pokus++, kam = -kam) {
          var nx = druhy.x + kam * pesky;
          if (pod && nx >= pod.x && nx + druhy.w <= pod.x + pod.w && (vedle === 0 || pokus === 0)) {
            druhy.x = nx; druhy.smer = kam; posun = pesky;
            break;
          }
        }
      }
      druhy.krok += posun;
      druhy.anim = !druhy.naZemi ? 'skok' : posun > 0 ? 'krok' : 'stoji';
      if (druhy.anim === 'stoji') druhy.smer = hrac.x > druhy.x ? 1 : -1;

      // Ája (jako ta, co jde po stopě) došla na plošinu se zubem.
      var z = plosina.zub;
      if (zub === 'ceka' && !scena && druhy === aja && aja.naZemi && Math.abs(aja.y + aja.h - z.y) < 0.5 && aja.x + aja.w > z.x && aja.x < z.x + z.w) {
        zacatekZubu();
      }

      // Došla na plošinu s checkpointem — nebo je už nad ním (návrat
      // z minihry nebo na checkpoint ji přenese výš), pak se dohraje teď.
      // Vždycky jen jeden, další až po jeho scéně.
      if (!scena && druhy.naZemi) {
        var nohyAji = druhy.y + druhy.h;
        CHECKPOINTY.some(function (cp) {
          if (hotovo[cp.id] || nohyAji > plosina[cp.id].y + 0.5) return false;
          hotovo[cp.id] = true;
          titulek(cp.titul, cp.datum);
          cp.scena();
          return true;
        });
      }
    }

    // Hráč hraje za Áju a sám doskočil na plošinu se zubem.
    if (zub === 'ceka' && !scena && hrac === aja && hrac.naZemi === plosina.zub) zacatekZubu();

    // Kolo: hráč doskočí na plošinu se silničkou a druhý je s ním.
    if (!scena && !hotovo.kolo && rezim === 'hra' && druhy.stav === 'sleduje' && hrac.naZemi === plosina.kolo) zacniJizdu();
    if (!scena && !hotovo.lezeni && rezim === 'hra' && druhy.stav === 'sleduje' && hrac.naZemi === plosina.lezeni) zacniStenu();

    // Věci pro Áju
    if (zub === 'bolest') {
      veci.forEach(function (v) {
        if (!v.mam && prekryv(hrac, { x: v.x, y: v.y, w: 7, h: 7 })) {
          v.mam = true;
          jiskry(v.x + 3, v.y + 3, 8);
          hudZub();
        }
      });
      if (!scena && prekryv(hrac, U_POSTELE)) predejVeci();
    }

    // Vrchol
    if (!scena && rezim === 'hra' && druhy.stav === 'sleduje' && hrac.naZemi === plosina.vrchol && prekryv(hrac, U_SCHRANKY)) zadost();
    if (prstenY !== null && !klek) prstenY = Math.max(SCHRANKA.y - 10, prstenY - 12 * dt);

    // Plošiny, které se právě odemkly, se zviditelní.
    PLOSINY.forEach(function (p) { if (pevna(p) && p.objev < 1) p.objev = Math.min(1, p.objev + dt * 2); });

    // Kamera jen svisle, plynule za Daníkem.
    var cil = Math.max(0, Math.min(SVET_V - H, hrac.y + hrac.h / 2 - H * 0.6));
    kamY += (cil - kamY) * Math.min(1, dt * 6);
  }

  // Částice a bublina — stejné pro lezení i jízdu na kole.
  function aktualizujCastice(dt) {
    for (var c = castice.length - 1; c >= 0; c--) {
      var k = castice[c];
      k.zivot -= dt;
      if (k.zivot <= 0) { castice.splice(c, 1); continue; }
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (k.tiz) k.vy += k.tiz * dt;                       // hozená věc letí obloukem
      else if (k.druh === 'srdce') { k.vx *= 0.98; k.vy *= 0.99; }
      else { k.vx *= 0.92; k.vy *= 0.92; }
    }
    if (bublina.kdo) {
      bublina.zbyva -= dt;
      if (bublina.zbyva <= 0) schovejBublinu();
    }
  }

  // ---------- Kreslení ----------
  function hexNaRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    var x = hexNaRgb(a), y = hexNaRgb(b);
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }).join(',') + ')';
  }

  // Hřebeny v pozadí, předpočítané (stejné při každé hře).
  function hreben(seed, vyska, cleny) {
    var out = [];
    for (var x = 0; x < W; x++) {
      var h = 0;
      for (var i = 0; i < cleny; i++) h += Math.sin(x * (0.03 + i * 0.037) + seed * (i + 1)) / (i + 1);
      out.push(Math.round(h * vyska));
    }
    return out;
  }
  var HREBEN_DALEKO = hreben(1.7, 7, 4);
  var HREBEN_BLIZKO = hreben(4.2, 9, 3);
  var MRAKY = [
    { x: 20, y: 30, w: 18 }, { x: 110, y: 10, w: 24 }, { x: 60, y: -120, w: 20 },
    { x: 130, y: -200, w: 16 }, { x: 15, y: -300, w: 22 }, { x: 90, y: -380, w: 18 }
  ];
  var MAKY = [8, 17, 29, 44, 52, 87, 95, 141, 150];

  function vykresli() {
    if (jizda) { vykresliJizdu(); return; }
    if (stena) { vykresliStenu(); return; }
    var kam = Math.round(kamY);
    var p = 1 - kamY / (SVET_V - H);   // 0 dole, 1 na vrcholu

    obloha(p);

    // Slunce zapadá za hřebeny.
    var dalekoY = Math.round(70 + p * 50), blizkoY = Math.round(95 + p * 90);
    if (p > 0.45) {
      ctx.globalAlpha = Math.min(1, (p - 0.45) * 3);
      ctx.fillStyle = '#F9D976';
      kruh(122, dalekoY - 4, 8);
      ctx.globalAlpha = 1;
    }

    // Mraky (posun poloviční rychlostí)
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    MRAKY.forEach(function (m) {
      var mx = Math.round(((m.x + cas * 3) % (W + 40)) - 20);
      var my = Math.round(m.y + kam * 0.15 - 100);
      ctx.fillRect(mx, my, m.w, 3);
      ctx.fillRect(mx + 3, my - 2, m.w - 8, 2);
    });

    sloupce(HREBEN_DALEKO, dalekoY, mix('#9DBFD6', '#8C6F94', p));
    kresliSnezku(dalekoY + 6, p);
    sloupce(HREBEN_BLIZKO, blizkoY, mix('#6F9C57', '#5A4E6E', p));

    ctx.save();
    ctx.translate(0, -kam);

    // Skalní stěna pod vrcholem
    ctx.fillStyle = 'rgba(110,104,94,0.35)';
    ctx.beginPath();
    ctx.moveTo(28, 92); ctx.lineTo(132, 92); ctx.lineTo(W, 230); ctx.lineTo(0, 230);
    ctx.fill();

    kresliZem();
    PLOSINY.forEach(function (pl) { if (!pl.zem && pl.y > kam - 8 && pl.y < kam + H + 8) kresliPlosinu(pl); });

    // Cedulky u milníků
    cedulka(plosina.zub, 'zub');
    CHECKPOINTY.forEach(function (cp) { cedulka(plosina[cp.id], cp.ikona, true); });
    // Místo cedulky stojí na plošině zaparkovaná silnička z minihry.
    var pk = plosina.kolo;
    ramKola(pk.x + pk.w - 3, pk.y - 4, pk.y - 4, 0, '#D7262E');
    vybaveni(plosina.lezeni);

    // Vrcholový kříž a schránka
    var v = plosina.vrchol;
    ctx.fillStyle = '#2E2418';
    ctx.fillRect(KRIZ_X, v.y - 26, 2, 26);
    ctx.fillRect(KRIZ_X - 5, v.y - 21, 12, 2);
    ctx.fillStyle = '#5F666B';
    ctx.fillRect(SCHRANKA.x + 4, SCHRANKA.y + 7, 1, 6);
    sprite(schrankaOtevrena ? SPR.veci.schrankaOtevrena : SPR.veci.schranka, SCHRANKA.x, SCHRANKA.y, 1);

    // Věci pro Áju (jen když je bolí zub)
    if (zub === 'bolest') {
      veci.forEach(function (vc) {
        if (vc.mam) return;
        var hop = Math.round(Math.sin(cas * 4 + vc.x) * 1.5);
        sprite(SPR.veci[vc.id], vc.x, vc.y + hop, 1);
        if (Math.sin(cas * 6 + vc.x) > 0.7) { ctx.fillStyle = '#FFF6C8'; ctx.fillRect(vc.x + 7, vc.y + hop - 1, 1, 1); }
      });
    }

    // Postel u zubu (s Ájou, dokud ji bolí zub)
    var zp = plosina.zub, ps = aja.stav === 'bolest' ? SPR.veci.postelSAjou : SPR.veci.postel;
    sprite(ps, POSTEL.x, zp.y - ps.h, 1);

    // Nejdřív ten, kdo jde po stopě, navrch hráč.
    [druhy, hrac].forEach(function (e) {
      if (e === aja && aja.stav === 'bolest') return;       // leží v posteli
      postava(e === aja ? SPR.aja : SPR.dan, e, animTela(e));
    });

    // Výběr postavy: nad Daníkem ←, nad Ájou →; vybraný podtržený.
    if (volba) {
      var blik = Math.floor(cas * 3) % 2;
      ctx.fillStyle = '#FFFFFF';
      if (volba.vyber === 'dan' || (!volba.vyber && blik)) sipka(dan.x + 3, dan.y - 6, -1);
      if (volba.vyber === 'aja' || (!volba.vyber && blik)) sipka(aja.x + 3, aja.y - 6, 1);
      if (volba.vyber) {
        var vy = volba.vyber === 'aja' ? aja : dan;
        ctx.fillStyle = '#F9D976';
        ctx.fillRect(vy.x - 2, ZEM + 3, 10, 1);
      }
    }

    // Prsten: vyletí ze schránky, pak ho Daník drží v natažené ruce.
    if (prstenY !== null) {
      var px = klek ? (dan.smer > 0 ? dan.x + dan.w + 2 : dan.x - 6) : SCHRANKA.x + 2;
      var py = klek ? dan.y + 6 : Math.round(prstenY);
      sprite(SPR.veci.prsten, px, py, 1);
      if (Math.sin(cas * 8) > 0.3) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px + 4, py - 1, 1, 1); ctx.fillRect(px + 5, py, 1, 1); }
    }

    kresliCastice();
    ctx.restore();

    umistiBublinu(kam);
  }

  // Obloha: den dole → západ slunce na vrcholu.
  function obloha(p) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#6FB2EC', '#4B4F8F', p));
    g.addColorStop(1, mix('#D2EAF8', '#F4B183', p));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function kresliCastice() {
    castice.forEach(function (k) {
      ctx.globalAlpha = k.tiz ? 1 : Math.min(1, k.zivot * 2);
      if (k.druh === 'jiskra') { ctx.fillStyle = '#FFF2A8'; ctx.fillRect(Math.round(k.x), Math.round(k.y), 1, 1); }
      else { var s = SPR.veci[k.druh]; sprite(s, Math.round(k.x - s.w / 2), Math.round(k.y - s.h / 2), 1); }
    });
    ctx.globalAlpha = 1;
  }

  // Ikony na cedulky, 5 × 4 px: w bílá, x červená.
  var IKONY = {
    zub:    ['.www.', '.www.', '.w.w.', '.w.w.'],
    srdce:  ['xx.xx', 'xxxxx', '.xxx.', '..x..'],
    dum:    ['..w..', '.www.', 'wwwww', 'ww.ww'],
    cepice: ['..w..', 'wwwww', '.www.', '.www.']
  };
  var BARVY_IKON = { w: '#FFFFFF', x: '#E33B4B' };

  // Dřevěná cedulka na levém, nebo pravém kraji plošiny.
  function cedulka(pl, ikona, vpravo) {
    var x0 = vpravo ? pl.x + pl.w - 9 : pl.x;
    ctx.fillStyle = '#6B4A26';
    ctx.fillRect(x0 + 4, pl.y - 9, 1, 9);
    ctx.fillRect(x0, pl.y - 15, 9, 7);
    IKONY[ikona].forEach(function (radek, y) {
      for (var x = 0; x < radek.length; x++) {
        if (radek[x] === '.') continue;
        ctx.fillStyle = BARVY_IKON[radek[x]];
        ctx.fillRect(x0 + 2 + x, pl.y - 14 + y, 1, 1);
      }
    });
  }

  function kruh(cx, cy, r) {
    for (var y = -r; y <= r; y++) {
      var s = Math.round(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - s, cy + y, s * 2, 1);
    }
  }

  // Sněžka mezi hřebeny: široký kužel, levý svah delší, nahoře plošinka
  // s Poštovnou a talíři polské observatoře, na pravém svahu sutě.
  var SNEZKA = (function () {
    var stred = 46, vyska = 32, vlevo = 64, vpravo = 52, out = [];
    for (var x = 0; x < W; x++) {
      var d = x - stred, sir = d < 0 ? vlevo : vpravo;
      var t = Math.max(0, Math.abs(d) - 4) / (sir - 4);   // ±4 px plochý vrchol
      out.push(t >= 1 ? -1 : Math.round(vyska * (1 - Math.pow(t, 1.15))));
    }
    return { stred: stred, vyska: vyska, profil: out };
  })();

  function kresliSnezku(zaklad, p) {
    var s = SNEZKA;
    ctx.fillStyle = mix('#86A9C2', '#76628C', p);
    for (var x = 0; x < W; x++) if (s.profil[x] >= 0) ctx.fillRect(x, zaklad - s.profil[x], 1, H);
    // Sutě: světlejší šikmé pruhy na pravém svahu
    ctx.fillStyle = mix('#A9C4D6', '#9483A6', p);
    [[52, 14], [58, 20], [63, 27]].forEach(function (s0) {
      for (var i = 0; i < 6; i++) ctx.fillRect(s0[0] + i, zaklad - s.profil[s0[0] + i] + 2 + Math.floor(i / 2), 1, 2);
    });
    // Budovy na vrcholu
    var vrch = zaklad - s.vyska;
    ctx.fillStyle = mix('#5F7E96', '#4E3F66', p);
    ctx.fillRect(s.stred - 3, vrch - 2, 3, 2);       // Poštovna
    ctx.fillRect(s.stred + 1, vrch - 3, 1, 3);       // observatoř — noha
    ctx.fillRect(s.stred - 1, vrch - 4, 5, 1);       //   a talíře
    ctx.fillRect(s.stred, vrch - 5, 3, 1);
  }

  function sloupce(vysky, zaklad, barva) {
    ctx.fillStyle = barva;
    for (var x = 0; x < W; x++) ctx.fillRect(x, zaklad - vysky[x], 1, H);
  }

  function sprite(s, x, y, smer) {
    ctx.drawImage(smer < 0 ? s.l : s.p, Math.round(x), Math.round(y));
  }

  // Animace: hráč podle pohybu, druhý podle stopy, ve scéně podle scénky.
  function animTela(e) {
    if (e === dan && klek) return 'klek';
    if (e !== hrac || e.stav === 'scena') {
      return e.anim === 'krok' ? (Math.floor(e.krok / 5) % 2 ? 'krok1' : 'krok2') : e.anim;
    }
    return !e.naZemi ? 'skok' : Math.abs(e.vx) > 5 ? (Math.floor(e.krok / 6) % 2 ? 'krok1' : 'krok2') : 'stoji';
  }

  function postava(sada, e, anim) {
    var s = sada[anim] || sada.stoji;
    sprite(s, e.x + e.w / 2 - s.w / 2, e.y + e.h - s.h, e.smer);
  }

  function barvyPatra(y) {
    if (y >= 474) return ['#99B949', '#6E9431', '#7A5A2E'];
    if (y >= 210) return ['#6E9A3A', '#496E16', '#5A3E1F'];
    return ['#DAD7CE', '#A9A59A', '#7D796F'];
  }

  function kresliPlosinu(pl) {
    var b = barvyPatra(pl.y);
    if (!pevna(pl) || pl.objev < 1) {
      // Duch: tečkovaný obrys, ať je vidět, kam se pak půjde.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (var x = pl.x; x < pl.x + pl.w; x += 3) { ctx.fillRect(x, pl.y, 1, 1); ctx.fillRect(x + 1, pl.y + 3, 1, 1); }
      if (!pevna(pl)) return;
      ctx.globalAlpha = pl.objev;
    }
    ctx.fillStyle = b[0]; ctx.fillRect(pl.x, pl.y, pl.w, 1);
    ctx.fillStyle = b[1]; ctx.fillRect(pl.x, pl.y + 1, pl.w, 1);
    ctx.fillStyle = b[2]; ctx.fillRect(pl.x + 1, pl.y + 2, pl.w - 2, 2);
    ctx.fillRect(pl.x + 3, pl.y + 4, pl.w - 6, 1);
    // Trsy trávy / kamínky na hraně
    ctx.fillStyle = b[0];
    for (var t = pl.x + 2; t < pl.x + pl.w - 1; t += 5) ctx.fillRect(t, pl.y - 1, 1, 1);
    ctx.globalAlpha = 1;
  }

  // Pixelový smrk: osa ve stred, pata = spodní řádek, vys v px.
  function smrk(stred, pata, vys) {
    ctx.fillStyle = '#2F4A1C';
    for (var r = 0; r < vys; r++) {
      var sir = Math.floor(r / 2.6) + 1;
      ctx.fillRect(stred - sir, pata - vys + r, sir * 2, 1);
    }
  }

  function kresliZem() {
    var y = ZEM;
    ctx.fillStyle = '#7A5A2E'; ctx.fillRect(0, y, W, SVET_V - y);
    ctx.fillStyle = '#99B949'; ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = '#6E9431'; ctx.fillRect(0, y + 2, W, 1);
    // Smrky po krajích
    [[-4, 34], [148, 30], [6, 22]].forEach(function (s) { smrk(s[0] + 6, y, s[1]); });
    // Vlčí máky
    MAKY.forEach(function (x, i) {
      var v = 3 + (i % 3);
      ctx.fillStyle = '#496E16'; ctx.fillRect(x, y - v, 1, v);
      ctx.fillStyle = '#D7262E'; ctx.fillRect(x - 1, y - v - 2, 3, 2);
    });
  }

  // ---------- Kolo ----------
  // Vodorovná jízda na silničkách. Daník šlape střídáním ← →, Ája jede
  // v jeho háku (závětří). Když Daník jede moc rychle, Ája z háku odpadne
  // a sama tak rychle nevydrží; když jede pomalu, ujíždí čas. Občas fouká
  // protivítr. Prohrát se nedá, jen se jede déle.
  var TRAT = 2600;                 // délka v px, ≈ 25–35 s jízdy
  var KOLO_X = 104;                // kde na obrazovce je Daníkovo přední kolo
  var SILNICE_Y = 112;
  var V_MAX = 160, SLAP = 8;       // šlápnutí přidá SLAP px/s; 3 za vteřinu ≈ 110 px/s
  var HAK_OD = 15, HAK_DO = 26;    // mezera mezi předními koly = Ája v háku
  var V_HAK = 128, V_SAMA = 120, V_SAMA_VITR = 95;
  var PRIDEJ_PO = 2, PRIDEJ_ZNOVU = 8;   // „Přidej!“ po 2 s v háku, pak každých 8 s
  var MAX_ZTRATA = 60;             // dál Ája neodpadne, ať zůstane na obrazovce

  function vyskaSilnice(x) { return 7 * Math.sin(x / 150) + 4 * Math.sin(x / 61 + 1.3); }
  function silniceY(x) { return SILNICE_Y - vyskaSilnice(x); }

  function zacniJizdu() {
    hotovo.kolo = true;
    titulek('koloTit');
    schovejBublinu();
    castice = [];
    jizda = {
      x: 0, v: 0, aX: -HAK_OD - 6, aV: 0, strana: '', faze: 'start',
      cas: 0, vHaku: 0, vitr: 0, dalsiVitr: 5, pockejZa: 0, hudText: '', vHakuVkuse: 0,
      danE: { x: 0, y: 0, w: 6 }, ajaE: { x: 0, y: 0, w: 6 }
    };
    pozicePostav();
    spustScenu([
      [0.6, function () { rekni(jizda.danE, 'doHaku', 1.8); hud(dvoj('slapej')); }],
      [2.2, function () { jizda.faze = 'jede'; }]
    ]);
  }

  function slapni(strana) {
    var j = jizda;
    if (!j || j.faze !== 'jede') return;
    if (strana !== j.strana) j.v = Math.min(V_MAX, j.v + SLAP);
    else j.v = Math.max(0, j.v - 4);          // dvakrát stejnou nohou = zakolísá
    j.strana = strana;
  }

  function aktualizujJizdu(dt) {
    var j = jizda;
    var sklon = (vyskaSilnice(j.x + 2) - vyskaSilnice(j.x - 2)) / 4;   // + do kopce

    // Protivítr: chvíli fouká, pak zase pár vteřin klid.
    if (j.faze === 'jede') {
      j.dalsiVitr -= dt;
      if (j.dalsiVitr <= 0) {
        j.vitr = j.vitr ? 0 : 1;
        j.dalsiVitr = j.vitr ? 2.5 : 4 + Math.random() * 3;
      }
    } else j.vitr = 0;

    // Daník: odpor vzduchu, kopce, vítr. V cíli dobrzdí.
    var odpor = j.v * 0.22 + sklon * 120 + j.vitr * 10 + (j.faze === 'jede' ? 0 : 60);
    j.v = Math.max(0, Math.min(V_MAX, j.v - odpor * dt));
    j.x += j.v * dt;

    // Ája drží mezeru kolem středu háku, ale rychlost má strop: v háku
    // vyšší, sama (a v protivětru) nižší.
    var mezera = j.x - j.aX;
    var vHaku = mezera >= HAK_OD && mezera <= HAK_DO;
    var strop = (vHaku ? V_HAK : j.vitr ? V_SAMA_VITR : V_SAMA) - sklon * 60;
    var chce = j.v + (mezera - (HAK_OD + HAK_DO) / 2) * 2.5;
    j.aV = priblizit(j.aV, Math.max(0, Math.min(chce, strop)), 140 * dt);
    j.aX += j.aV * dt;
    if (j.x - j.aX < HAK_OD - 1) { j.aX = j.x - (HAK_OD - 1); j.aV = Math.min(j.aV, j.v); }
    if (j.x - j.aX > MAX_ZTRATA) j.aX = j.x - MAX_ZTRATA;

    if (j.faze === 'jede') {
      j.cas += dt;
      if (vHaku) j.vHaku += dt;
      // V háku v kuse PRIDEJ_PO s → popožene Daníka; když tam zůstane,
      // zopakuje to po PRIDEJ_ZNOVU s.
      j.vHakuVkuse = vHaku ? j.vHakuVkuse + dt : 0;
      if (j.vHakuVkuse >= PRIDEJ_PO && !bublina.kdo) { rekni(j.ajaE, 'pridej', 1.2); j.vHakuVkuse = PRIDEJ_PO - PRIDEJ_ZNOVU; }
      j.pockejZa -= dt;
      if (mezera > 50 && j.pockejZa <= 0) { rekni(j.ajaE, 'pockej', 1.4); j.pockejZa = 5; }
      var text = j.cas < 3 ? 'slapej' : (vHaku ? 'vHaku' : 'odpadla') + (j.vitr ? '+vitr' : '');
      if (text !== j.hudText) {
        j.hudText = text;
        hud(text === 'slapej' ? dvoj('slapej') : dvoj(vHaku ? 'vHaku' : 'odpadla') + (j.vitr ? ' · ' + dvoj('vitr') : ''));
      }
      if (j.x >= TRAT) dojeli();
    }
    pozicePostav();
  }

  // Kotvy pro bubliny, v souřadnicích obrazovky.
  function pozicePostav() {
    var j = jizda;
    j.danE.x = KOLO_X - 12; j.danE.y = silniceY(j.x) - 24;
    j.ajaE.x = KOLO_X - (j.x - j.aX) - 12; j.ajaE.y = silniceY(j.aX) - 24;
  }

  function dojeli() {
    var j = jizda;
    j.faze = 'cil';
    var podil = Math.round(100 * j.vHaku / Math.max(1, j.cas));
    var vysledek = dvoj('vCili') + ' ' + casMmSs(j.cas) + ' · ' + podil + ' % ' + dvoj('podilHaku');
    hud(vysledek);
    spustScenu([
      [1.0, function () { rekni(j.ajaE, 'jizda', 1.8); srdicka(j.ajaE.x + 3, j.ajaE.y + 8, 6); }],
      [2.8, function () { j.faze = 'nabidka'; hud(vysledek + '<br>' + dvoj('znovuJet')); }]
    ]);
  }

  // Po dojetí: mezerník = jet znovu, ↑ = zpátky na horu.
  function poJizde(kod) {
    if (kod === 'Space') zacniJizdu();
    else if (kod === 'ArrowUp' || kod === 'KeyW') navratNa(plosina.kolo);
  }

  function vykresliJizdu() {
    var j = jizda;
    var kamX = j.x - KOLO_X;
    var p = 1 - kamY / (SVET_V - H);   // obloha jako ve výšce, kde se jede

    obloha(p);
    vlna(kamX * 0.15, 76, 9, mix('#9DBFD6', '#8C6F94', p), 1.7);
    vlna(kamX * 0.4, 96, 7, mix('#6F9C57', '#5A4E6E', p), 4.2);

    // Smrky u silnice (posun 0,8)
    var posunS = kamX * 0.8;
    for (var i = Math.floor(posunS / 37) - 1; i < Math.floor((posunS + W) / 37) + 2; i++) {
      var sx = Math.round(i * 37 + ((i * 17) % 13) - posunS), vys = 14 + (i * 7) % 9;
      smrk(sx + 4, Math.round(silniceY(kamX + sx) - 1), vys);
    }

    // Silnice s přerušovanou čárou, pod ní louka
    for (var x = 0; x < W; x++) {
      var wx = kamX + x, ry = Math.round(silniceY(wx));
      ctx.fillStyle = '#55585E'; ctx.fillRect(x, ry, 1, 6);
      ctx.fillStyle = '#8A8D93'; ctx.fillRect(x, ry, 1, 1);
      if (Math.floor(wx / 6) % 2 === 0) { ctx.fillStyle = '#E8E8E0'; ctx.fillRect(x, ry + 3, 1, 1); }
      ctx.fillStyle = '#496E16'; ctx.fillRect(x, ry + 6, 1, 1);
      ctx.fillStyle = '#6E9A3A'; ctx.fillRect(x, ry + 7, 1, H);
    }

    // Cíl: dvě tyče a šachovnicová páska
    var cx = Math.round(TRAT - kamX);
    if (cx > -20 && cx < W + 20) {
      var cy = Math.round(silniceY(TRAT));
      ctx.fillStyle = '#3A3A3A';
      ctx.fillRect(cx - 12, cy - 24, 1, 24); ctx.fillRect(cx + 4, cy - 24, 1, 30);
      for (var bx = 0; bx < 16; bx++) for (var by = 0; by < 4; by++) {
        ctx.fillStyle = (bx + by) % 2 ? '#FFFFFF' : '#1B1B1B';
        ctx.fillRect(cx - 12 + bx, cy - 26 + by, 1, 1);
      }
    }

    kolo(KOLO_X - (j.x - j.aX), j.aX, SPR.aja.stoji, '#D7262E', '#1B1B1B');
    kolo(KOLO_X, j.x, SPR.dan.stoji, '#2F6FD6', '#4A4F57');

    // Protivítr: bílé čáry letí proti nim
    if (j.vitr) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (var v = 0; v < 7; v++) {
        var vx = Math.round(W - ((cas * 190 + v * 53) % (W + 20)));
        ctx.fillRect(vx, 18 + (v * 23) % 70, 6 + v % 3 * 2, 1);
      }
    }

    // Měřák háku (vlevo dole): zelená zóna = hák, bílá čárka = Ája
    var mezera = j.x - j.aX, mx = 4, my = H - 7;
    ctx.fillStyle = 'rgba(12,26,6,0.6)'; ctx.fillRect(mx - 1, my - 1, 62, 4);
    ctx.fillStyle = '#7FC24A'; ctx.fillRect(mx + 60 - HAK_DO, my, HAK_DO - HAK_OD, 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(mx + 60 - Math.round(Math.min(60, mezera)), my - 1, 1, 4);
    // Ujetá trať (vpravo dole)
    ctx.fillStyle = 'rgba(12,26,6,0.6)'; ctx.fillRect(W - 54, my, 50, 2);
    ctx.fillStyle = '#F2C94C'; ctx.fillRect(W - 54, my, Math.round(50 * Math.min(1, j.x / TRAT)), 2);

    kresliCastice();
    umistiBublinu(0);
  }

  // Zvlněný hřeben, který se posouvá do strany (pozadí jízdy).
  function vlna(posun, zaklad, vyska, barva, seed) {
    ctx.fillStyle = barva;
    for (var x = 0; x < W; x++) {
      var wx = x + posun;
      var h = Math.sin(wx * 0.03 + seed) + Math.sin(wx * 0.071 + seed * 2) / 2 + Math.sin(wx * 0.13 + seed * 3) / 3;
      ctx.fillRect(x, Math.round(zaklad - h * vyska), 1, H);
    }
  }

  // Silnička s cyklistou. sx = přední kolo na obrazovce, d = ujetá
  // vzdálenost (podle ní se točí kola a pedály). Z postavy se bere jen
  // hlava a trup (13 řádků), nohy šlapou zvlášť.
  function kolo(sx, d, postavaSpr, barvaRamu, barvaNohou) {
    sx = Math.round(sx);
    var g = ramKola(sx, Math.round(silniceY(d)) - 3, Math.round(silniceY(d - 11)) - 3, d, barvaRamu);
    var sedlo = g.sedlo, riditka = g.riditka, stredovka = g.stredovka;

    // Nohy: od sedla ke dvěma pedálům naproti sobě
    var a = d / 5;
    ctx.fillStyle = barvaNohou;
    linka(sedlo.x, sedlo.y, Math.round(stredovka.x + Math.cos(a) * 2.5), Math.round(stredovka.y + Math.sin(a) * 2.5));
    linka(sedlo.x, sedlo.y, Math.round(stredovka.x - Math.cos(a) * 2.5), Math.round(stredovka.y - Math.sin(a) * 2.5));

    // Hlava a trup, mírně předkloněný nad sedlem
    var s = postavaSpr, radku = 13;
    var dx = sedlo.x - 4, dy = sedlo.y - radku + 2;
    ctx.drawImage(s.p, 0, 0, s.w, radku, dx, dy, s.w, radku);
    ctx.fillStyle = '#F4C9A3';
    linka(dx + 8, dy + 10, riditka.x, riditka.y - 1);      // ruka na řídítkách
  }

  // Samotná silnička bez jezdce: kola a rám. yP, yZ = střed předního
  // a zadního kola, d = natočení paprsků. Vrací body, kde sedí jezdec.
  function ramKola(sx, yP, yZ, d, barvaRamu) {
    var stred = Math.round((yP + yZ) / 2);
    var sedlo = { x: sx - 9, y: stred - 6 }, riditka = { x: sx - 2, y: stred - 7 }, stredovka = { x: sx - 6, y: stred + 1 };

    [[sx - 1, yP], [sx - 12, yZ]].forEach(function (k) {
      ctx.fillStyle = '#1B1B1B';
      for (var a = 0; a < 16; a++) {
        ctx.fillRect(Math.round(k[0] + Math.cos(a / 16 * 6.283) * 3), Math.round(k[1] + Math.sin(a / 16 * 6.283) * 3), 1, 1);
      }
      ctx.fillStyle = '#9DA3A8';   // paprsek, který se točí
      ctx.fillRect(Math.round(k[0] + Math.cos(d / 3) * 2), Math.round(k[1] + Math.sin(d / 3) * 2), 1, 1);
    });

    ctx.fillStyle = barvaRamu;
    linka(sx - 12, yZ, stredovka.x, stredovka.y);
    linka(stredovka.x, stredovka.y, sedlo.x, sedlo.y);
    linka(sedlo.x, sedlo.y, riditka.x, riditka.y);
    linka(stredovka.x, stredovka.y, riditka.x, riditka.y);
    linka(riditka.x, riditka.y, sx - 1, yP);
    ctx.fillStyle = '#1B1B1B';
    ctx.fillRect(sedlo.x - 1, sedlo.y - 1, 3, 1);         // sedlo
    ctx.fillRect(riditka.x, riditka.y - 1, 2, 1);         // řídítka
    return { sedlo: sedlo, riditka: riditka, stredovka: stredovka };
  }

  function linka(x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 512; n++) {        // pojistka; nejdelší lano přes celou stěnu má ~200 px
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }

  // ---------- Lezení ----------
  // Sportovka na Sicílii (únor 2026). Na začátku si hráč vybere, kdo
  // poleze (← Ája, → Daník); druhý dole jistí. Další chyt se zvýrazní
  // a šipka ← ↑ → podle toho, kde leží, na něj přeleze. Síla v rukou
  // pořád ubývá; u nýtu se musí mezerníkem zacvaknout expreska (trochu si
  // při tom odpočine). Když síla dojde, lezec spadne k poslední
  // zacvaknuté expresce a jistič ho chytí. Prohrát se nedá.
  var CESTA = 'NNRNLNNRRNLLNNRNLNRN';      // N nahoru, L doleva, R doprava
  var NYT_KAZDY = 4;                       // nýt u každého 4. chytu
  var PATA_STENY = 300;                    // y země pod stěnou (vlastní svět stěny)
  var UBYTEK_SILY = 0.12, ZA_CHYT = 0.03, ZA_CHYBU = 0.15, ZA_CVAK = 0.2;
  var VAHANI = 1.5, UBYTEK_VAHANI = 0.06;    // kdo stojí déle než VAHANI s, ztrácí sílu rychleji
  var SMER_KLAVESY = { vlevo: 'L', nahoru: 'N', vpravo: 'R' };
  // Ája je rychlejší, ale dřív jí dojde; Daník je pomalejší, ale vydrží déle.
  // tah = jak dlouho trvá přelézt na další chyt (s), ubytek = násobek UBYTEK_SILY.
  var LEZCI = {
    aja: { tah: 0.18, ubytek: 1.3 },
    dan: { tah: 0.38, ubytek: 0.75 }
  };
  var JISTIC = { x: 58 };                  // kde pod stěnou stojí ten, kdo jistí
  var LEZEC_DOLE = { x: 80 };              // kde stojí lezec, než začne (a kam ho spustí)
  function spritySteny(kdo) { return kdo === 'aja' ? SPR.aja : SPR.dan; }

  var CHYTY = (function () {
    var x = 80, y = PATA_STENY - 22, out = [{ x: x, y: y, smer: 'N' }];
    for (var i = 0; i < CESTA.length; i++) {
      var s = CESTA[i];
      if (s === 'L' && x - 9 < 52) s = 'R';    // ať cesta nevyjede ze stěny
      if (s === 'R' && x + 9 > 108) s = 'L';
      x += s === 'L' ? -9 : s === 'R' ? 9 : 0;
      y -= s === 'N' ? 11 : 6;
      out.push({ x: x, y: y, smer: s, nyt: (i + 1) % NYT_KAZDY === 0 && i < CESTA.length - 1 });
    }
    return out;
  })();
  var VRCH_STENY = CHYTY[CHYTY.length - 1].y;

  function zacniStenu() {
    hotovo.lezeni = true;
    titulek('lezeniTit', 'lezeniDat');
    schovejBublinu();
    castice = [];
    var c = CHYTY[0];
    stena = {
      i: 0, sila: 1, cvak: -1, faze: 'volba', cas: 0, pady: 0, hudText: '', odTahu: 0,
      lezec: null, jistic: null, vyber: null, zamek: 0, cekajici: null,
      lezX: LEZEC_DOLE.x, lezY: c.y, cilX: LEZEC_DOLE.x, cilY: c.y, kamY: PATA_STENY + 24 - H,
      lezecE: { x: 0, y: 0, w: 6 }, jisticE: { x: JISTIC.x, y: 0, w: 6 }
    };
    hud(dvoj('kdoLeze') + '<br>' + dvoj('lezciInfo'));
  }

  // ← Ája, → Daník. Ten druhý jde jistit.
  function vyberLezce(kdo) {
    var s = stena;
    s.lezec = kdo;
    s.jistic = kdo === 'aja' ? 'dan' : 'aja';
    s.faze = 'start';
    hud('');
    s.jisticE.y = PATA_STENY - spritySteny(s.jistic).stoji.h;
    // Kdo stál na „špatné“ straně, přejde: lezec ke stěně, jistič stranou.
    s.lezX = kdo === 'aja' ? JISTIC.x : LEZEC_DOLE.x;
    s.lezY = PATA_STENY - spritySteny(kdo).stoji.h + 3;
    s.jisX = kdo === 'aja' ? LEZEC_DOLE.x : JISTIC.x;
    s.cilX = CHYTY[0].x; s.cilY = CHYTY[0].y;
    spustScenu([
      [0.4, function () { rekni(s.jisticE, 'jistim', 1.6); }],
      [2.0, function () { s.faze = 'leze'; }]
    ]);
  }

  function tahNaStene(kod) {
    var s = stena;
    if (s && s.faze === 'volba') {
      // Šipky přepínají, mezerník potvrdí.
      if (kod === 'vlevo' || kod === 'vpravo') s.vyber = kod === 'vlevo' ? 'aja' : 'dan';
      if (kod === 'cvak' && s.vyber) vyberLezce(s.vyber);
      return;
    }
    if (s && s.faze === 'nabidka') {
      if (kod === 'cvak') zacniStenu();
      if (kod === 'nahoru') navratNa(plosina.lezeni);
      return;
    }
    if (!s || s.faze !== 'leze') return;
    var chyt = CHYTY[s.i], dalsi = CHYTY[s.i + 1];
    var nezacvaknuto = chyt.nyt && s.cvak < s.i;
    if (kod === 'cvak') {
      if (!nezacvaknuto) return;
      s.cvak = s.i;
      s.sila = Math.min(1, s.sila + ZA_CVAK);
      s.odTahu = 0;
      jiskry(chyt.x + 5, chyt.y - 3, 6);
      return;
    }
    if (nezacvaknuto || !dalsi) return;      // nejdřív expreska
    // Ještě přelézá na předchozí chyt: šipku si zapamatuje a provede pak.
    if (s.zamek > 0) { s.cekajici = kod; return; }
    if (SMER_KLAVESY[kod] === dalsi.smer) {
      s.i++;
      s.cilX = dalsi.x; s.cilY = dalsi.y;
      s.sila = Math.min(1, s.sila + ZA_CHYT);
      s.odTahu = 0;
      s.zamek = LEZCI[s.lezec].tah;
      if (s.i === CHYTY.length - 1) nahore();
    } else {
      // Špatný chyt: zakolísá a ztratí sílu.
      s.sila -= ZA_CHYBU;
      s.lezX += kod === 'vlevo' ? -3 : kod === 'vpravo' ? 3 : 0;
      s.lezY -= kod === 'nahoru' ? 3 : 0;
    }
  }

  function spadni() {
    var s = stena;
    var kam = s.cvak >= 0 ? s.cvak : 0;
    s.faze = 'pad';
    s.pady++;
    s.zamek = 0; s.cekajici = null;
    s.cilX = CHYTY[kam].x;
    s.cilY = CHYTY[kam].y + (s.cvak >= 0 ? 12 : 0);   // visí kus pod expreskou
    spustScenu([
      [0.5, function () { rekni(s.jisticE, 'mamTe', 1.4); }],
      [1.8, function () {
        s.i = kam; s.cilY = CHYTY[kam].y; s.sila = 1; s.odTahu = 0; s.faze = 'leze';
      }]
    ]);
  }

  function nahore() {
    var s = stena;
    s.faze = 'nahore';
    spustScenu([
      [0.3, function () { rekni(s.lezecE, 'dobirej', 1.2); }],
      [1.6, function () { rekni(s.lezecE, 'spoustej', 1.2); s.faze = 'spousti'; }]
    ]);
  }

  function dole() {
    var s = stena;
    s.faze = 'konec';
    var pady = { cs: s.pady === 1 ? 'pád' : s.pady >= 2 && s.pady <= 4 ? 'pády' : 'pádů', en: s.pady === 1 ? 'fall' : 'falls' };
    var vysledek = dvoj('dolezeno') + ' ' + casMmSs(s.cas) + ' · ' + s.pady + ' ' +
        '<span class="jazyk-cs">' + pady.cs + '</span><span class="jazyk-en">' + pady.en + '</span>';
    hud(vysledek);
    spustScenu([
      [0.3, function () { rekni(s.jisticE, 'krasnaCesta', 1.8); srdicka(JISTIC.x + 3, s.jisticE.y - 4, 6); }],
      [2.2, function () { s.faze = 'nabidka'; hud(vysledek + '<br>' + dvoj('znovuLezt')); }]
    ]);
  }

  function aktualizujStenu(dt) {
    var s = stena;
    // Přesun na chyt trvá zhruba LEZCI[…].tah (Ája rychleji, Daník pomaleji).
    var rychlost = s.faze === 'pad' ? 7 : s.faze === 'spousti' ? 2.2 : s.lezec ? 3 / LEZCI[s.lezec].tah : 14;
    if (s.zamek > 0) {
      s.zamek -= dt;
      if (s.zamek <= 0 && s.cekajici) { var k = s.cekajici; s.cekajici = null; tahNaStene(k); }
    }
    s.lezX += (s.cilX - s.lezX) * Math.min(1, dt * rychlost);
    s.lezY += (s.cilY - s.lezY) * Math.min(1, dt * rychlost);

    if (s.faze === 'leze') {
      s.cas += dt;
      s.odTahu += dt;
      s.sila -= (UBYTEK_SILY + (s.odTahu > VAHANI ? UBYTEK_VAHANI : 0)) * LEZCI[s.lezec].ubytek * dt;
      if (s.sila <= 0) { s.sila = 0; spadni(); }
      var chyt = CHYTY[s.i];
      var text = chyt.nyt && s.cvak < s.i ? 'cvakni' : s.cas < 4 ? 'lezNapoveda' : '';
      if (text !== s.hudText) { s.hudText = text; hud(text ? dvoj(text) : ''); }
    }
    if (s.faze === 'spousti') {
      s.cilX = LEZEC_DOLE.x; s.cilY = PATA_STENY - spritySteny(s.lezec).stoji.h + 3;
      if (Math.abs(s.lezY - s.cilY) < 1) dole();
    }
    if (s.jistic) s.jisX += (JISTIC.x - s.jisX) * Math.min(1, dt * 6);

    var cil = Math.max(VRCH_STENY - 40, Math.min(PATA_STENY + 24 - H, s.lezY - 70));
    s.kamY += (cil - s.kamY) * Math.min(1, dt * 5);
    s.lezecE.x = s.lezX - 3; s.lezecE.y = s.lezY - 3;
    s.jisticE.x = s.jisX;
  }

  function vykresliStenu() {
    var s = stena, kam = Math.round(s.kamY);
    var kamDole = PATA_STENY + 24 - H, kamNahore = VRCH_STENY - 40;
    var p = (kamDole - s.kamY) / (kamDole - kamNahore);        // 0 dole, 1 nahoře

    // Středomořská obloha, moře a zasněžená Etna (únor)
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5FA8E0'); g.addColorStop(1, '#F3E3B8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var hor = Math.round(92 + p * 30);
    ctx.fillStyle = '#A99B83';
    for (var ex = 120; ex < W; ex++) {
      var ev = Math.max(0, 16 - Math.abs(ex - 145) * 0.7);
      ctx.fillRect(ex, hor - Math.round(ev), 1, Math.round(ev));
      if (ev > 12) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ex, hor - Math.round(ev), 1, Math.round(ev) - 11); ctx.fillStyle = '#A99B83'; }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';            // obláček kouře z Etny
    ctx.fillRect(142, hor - 21, 5, 2); ctx.fillRect(144, hor - 23, 4, 2);
    ctx.fillStyle = '#2E7FB8'; ctx.fillRect(0, hor, W, H);
    ctx.fillStyle = '#4C9AD0'; ctx.fillRect(0, hor, W, 1);
    ctx.fillStyle = '#FFFFFF';
    for (var m = 0; m < 9; m++) {
      if ((Math.floor(cas * 3) + m) % 3) continue;
      ctx.fillRect((m * 29 + 7) % W, hor + 3 + (m * 7) % 24, 2, 1);
    }

    ctx.save();
    ctx.translate(0, -kam);

    // Vápencová stěna s vlnitými okraji, žebry a oranžovými záteky
    for (var y = Math.max(VRCH_STENY - 30, kam); y < Math.min(PATA_STENY, kam + H); y++) {
      var od = Math.round(34 + 3 * Math.sin(y / 17) + 2 * Math.sin(y / 7.3));
      var po = Math.round(126 + 3 * Math.sin(y / 13 + 1) + 2 * Math.sin(y / 5.7));
      if (y < VRCH_STENY - 10) { var zuzeni = (VRCH_STENY - 10 - y) * 2; od += zuzeni; po -= zuzeni; }
      if (po <= od) continue;
      ctx.fillStyle = '#E2CFA5'; ctx.fillRect(od, y, po - od, 1);
      ctx.fillStyle = '#C9B387';
      ctx.fillRect(od, y, 2, 1);
      ctx.fillRect(od + (y * 37) % (po - od), y, 1, 1);
      ctx.fillRect(od + (y * 53 + 11) % (po - od), y, 1, 1);
      ctx.fillStyle = '#D9A86A';
      if (Math.sin(y / 23) > 0.4) ctx.fillRect(70 + Math.round(Math.sin(y / 9)), y, 2, 1);
    }

    // Zem pod stěnou: kamenitá polička, tráva a opuncie
    ctx.fillStyle = '#B8A27A'; ctx.fillRect(0, PATA_STENY, W, 30);
    ctx.fillStyle = '#7E9A4A'; ctx.fillRect(0, PATA_STENY, W, 1);
    ctx.fillStyle = '#5E8A3A';
    ctx.fillRect(16, PATA_STENY - 8, 4, 6); ctx.fillRect(13, PATA_STENY - 12, 3, 5); ctx.fillRect(20, PATA_STENY - 13, 3, 6);
    ctx.fillStyle = '#E8B23A'; ctx.fillRect(14, PATA_STENY - 13, 1, 1); ctx.fillRect(21, PATA_STENY - 14, 1, 1);

    // Chyty, nýty, expresky, řetěz na vrcholu
    CHYTY.forEach(function (c, i) {
      ctx.fillStyle = '#7A5A30'; ctx.fillRect(c.x - 1, c.y - 1, 3, 2);
      if (c.nyt) {
        // Plaketa 3 × 3 s tmavým otvorem, ať je na pískovci vidět i zdálky.
        ctx.fillStyle = '#9DA3A8'; ctx.fillRect(c.x + 4, c.y - 4, 3, 3);
        ctx.fillStyle = '#4A5055'; ctx.fillRect(c.x + 5, c.y - 3, 1, 1);
        // Ten, který je právě potřeba zacvaknout, bliká.
        if (i === s.i && i > s.cvak && s.faze === 'leze' && Math.floor(cas * 4) % 2) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(c.x + 3, c.y - 5, 5, 1); ctx.fillRect(c.x + 3, c.y - 1, 5, 1);
          ctx.fillRect(c.x + 3, c.y - 4, 1, 3); ctx.fillRect(c.x + 7, c.y - 4, 1, 3);
        }
        if (i <= s.cvak) { ctx.fillStyle = '#5F666B'; ctx.fillRect(c.x + 5, c.y - 1, 1, 3); ctx.fillStyle = '#E33B4B'; ctx.fillRect(c.x + 5, c.y + 1, 1, 1); }
      }
    });
    var vrch = CHYTY[CHYTY.length - 1];
    ctx.fillStyle = '#8A9096';
    ctx.fillRect(vrch.x + 3, vrch.y - 6, 1, 4); ctx.fillRect(vrch.x + 7, vrch.y - 6, 1, 4); ctx.fillRect(vrch.x + 4, vrch.y - 2, 3, 1);
    if (s.faze === 'leze' && CHYTY[s.i + 1] && !(CHYTY[s.i].nyt && s.cvak < s.i)) {
      var d = CHYTY[s.i + 1];
      ctx.fillStyle = Math.floor(cas * 4) % 2 ? '#FFFFFF' : '#F9D976';
      ctx.fillRect(d.x - 3, d.y - 3, 7, 1); ctx.fillRect(d.x - 3, d.y + 2, 7, 1);
      ctx.fillRect(d.x - 3, d.y - 2, 1, 4); ctx.fillRect(d.x + 3, d.y - 2, 1, 4);
    }

    // Výběr, kdo poleze: oba stojí dole, nad Ájou ←, nad Daníkem →
    if (s.faze === 'volba') {
      var sa = SPR.aja.stoji, sd = SPR.dan.stoji;
      sprite(sa, JISTIC.x + 3 - sa.w / 2, PATA_STENY - sa.h, 1);
      sprite(sd, LEZEC_DOLE.x + 3 - sd.w / 2, PATA_STENY - sd.h, -1);
      // Než hráč vybere, blikají obě šipky; pak svítí jen ta nad vybraným.
      var blik = Math.floor(cas * 3) % 2;
      ctx.fillStyle = '#FFFFFF';
      if (s.vyber === 'aja' || (!s.vyber && blik)) sipka(JISTIC.x + 3, PATA_STENY - sa.h - 6, -1);
      if (s.vyber === 'dan' || (!s.vyber && blik)) sipka(LEZEC_DOLE.x + 3, PATA_STENY - sd.h - 6, 1);
      if (s.vyber) {
        ctx.fillStyle = '#F9D976';               // podtržení vybraného
        ctx.fillRect((s.vyber === 'aja' ? JISTIC.x : LEZEC_DOLE.x) - 2, PATA_STENY + 2, 10, 1);
      }
    } else {
      // Lano: od jističe přes zacvaknuté expresky k lezcovu úvazku
      var lezSpr = spritySteny(s.lezec), jisSpr = spritySteny(s.jistic).stoji;
      ctx.fillStyle = '#F2C94C';
      var lx = Math.round(s.jisX) + 4, ly = PATA_STENY - 9;
      CHYTY.forEach(function (c, i) {
        if (!c.nyt || i > s.cvak) return;
        linka(lx, ly, c.x + 5, c.y + 1);
        lx = c.x + 5; ly = c.y + 1;
      });
      // Nahoře se lezec přicvakne do kotvy a spouští se přes ni.
      if (s.faze === 'nahore' || s.faze === 'spousti' || s.faze === 'konec' || s.faze === 'nabidka') {
        linka(lx, ly, vrch.x + 5, vrch.y - 2);
        lx = vrch.x + 5; ly = vrch.y - 2;
      }
      linka(lx, ly, Math.round(s.lezX), Math.round(s.lezY + 8));

      sprite(jisSpr, s.jisX + 3 - jisSpr.w / 2, PATA_STENY - jisSpr.h, 1);
      var ls = s.faze === 'leze' || s.faze === 'pad' || s.faze === 'nahore' ? lezSpr.skok : lezSpr.stoji;
      sprite(ls, s.lezX - ls.w / 2, s.lezY - 3, 1);
    }

    kresliCastice();
    ctx.restore();

    // Síla v rukou (vlevo dole)
    var my = H - 7;
    ctx.fillStyle = 'rgba(12,26,6,0.6)'; ctx.fillRect(3, my - 1, 52, 4);
    ctx.fillStyle = s.sila < 0.3 ? '#E33B4B' : '#7FC24A';
    ctx.fillRect(4, my, Math.round(50 * Math.max(0, s.sila)), 2);

    umistiBublinu(kam);
  }

  // Malá šipka (3 px) ve směru smer, hrot na x.
  function sipka(x, y, smer) {
    ctx.fillRect(x - 2, y, 5, 1);
    ctx.fillRect(x + 2 * smer, y - 1, 1, 3);
    ctx.fillRect(x + 3 * smer, y, 1, 1);
  }

  // Na plošině s lezením: batoh a lano v panence místo cedulky.
  function vybaveni(pl) {
    var b = SPR.veci.batoh, l = SPR.veci.panenka, x0 = pl.x + pl.w - b.w - l.w - 2;
    sprite(b, x0, pl.y - b.h, 1);
    sprite(l, x0 + b.w + 1, pl.y - l.h, 1);
  }

  // ---------- Bublina nad postavou ----------
  var skala = 1;
  function umistiBublinu(kam) {
    if (!bublina.kdo) return;
    var e = bublina.kdo;
    var sx = (e.x + e.w / 2) * skala;
    var sy = (e.y - kam - 3) * skala;
    var pul = bublinaEl.offsetWidth / 2;
    var max = W * skala - pul - 4;
    bublinaEl.style.left = Math.max(pul + 4, Math.min(max, sx)) + 'px';
    bublinaEl.style.top = Math.max(bublinaEl.offsetHeight + 4, sy) + 'px';
  }

  function zmerit() {
    var sirka = okno.parentElement.clientWidth;
    var s = Math.floor(Math.min(sirka / W, (window.innerHeight - 60) / H));
    skala = Math.max(1, Math.min(s, 5));
    platno.style.width = W * skala + 'px';
    platno.style.height = H * skala + 'px';
  }

  // ---------- Smyčka ----------
  // Vždycky nejvýš jeden naplánovaný snímek: zastav() ho zruší a smyčka
  // další naplánuje, jen když ji aktualizace mezitím nezastavila.
  var bezi = false, snimek = 0, naposled = 0, akumulator = 0;
  function smycka(t) {
    snimek = 0;
    if (!bezi) return;
    var dt = Math.min((t - naposled) / 1000, 0.1);
    naposled = t;
    akumulator += dt;
    while (akumulator >= KROK) { aktualizuj(KROK); akumulator -= KROK; }
    vykresli();
    if (bezi) snimek = requestAnimationFrame(smycka);
  }
  function spust() {
    if (bezi) return;
    bezi = true;
    naposled = performance.now();
    akumulator = 0;
    snimek = requestAnimationFrame(smycka);
  }
  function zastav() {
    bezi = false;
    if (snimek) { cancelAnimationFrame(snimek); snimek = 0; }
  }

  function hrat() {
    if (rezim === 'uvod' || rezim === 'konec') {
      novaHra();
      // Výběr postavy; při ladění s ?hra=… nebo ?za=… se přeskakuje.
      if (!/[?&](hra|za)=/.test(location.search) || /[?&]volba/.test(location.search)) zacniVolbu();
    }
    rezim = 'hra';
    panel.hidden = true;
    okno.focus({ preventScroll: true });
    var r = okno.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) okno.scrollIntoView({ block: 'center', behavior: 'smooth' });
    spust();
  }
  function pauza() {
    if (rezim !== 'hra') return;
    rezim = 'pauza';
    klavesy.vlevo = klavesy.vpravo = klavesy.skok = false;
    ukazPanel('pauza');
    zastav();
  }

  // ---------- Vstup ----------
  var KLAVESY = {
    ArrowLeft: 'vlevo', KeyA: 'vlevo',
    ArrowRight: 'vpravo', KeyD: 'vpravo',
    Space: 'skok', ArrowUp: 'skok', KeyW: 'skok'
  };
  okno.addEventListener('keydown', function (e) {
    var pauzaKlavesa = e.code === 'Escape' || e.code === 'KeyP';
    if (rezim !== 'hra') {
      // Escape / P z pauzy zpátky do hry. Mezerník a šipky nad panelem
      // nesmí rolovat stránkou — na tlačítku ale mezerník tlačítko zmáčkne.
      if (rezim === 'pauza' && pauzaKlavesa && !e.repeat) { hrat(); e.preventDefault(); return; }
      if (KLAVESY[e.code] && !(e.target.closest && e.target.closest('button'))) e.preventDefault();
      return;
    }
    if (pauzaKlavesa) { pauza(); e.preventDefault(); return; }
    var k = KLAVESY[e.code];
    if (!k) return;
    e.preventDefault();
    if (volba) {
      // ← Daník, → Ája, mezerník potvrdí.
      if (!e.repeat && k === 'vlevo') volba.vyber = 'dan';
      if (!e.repeat && k === 'vpravo') volba.vyber = 'aja';
      if (!e.repeat && e.code === 'Space' && volba.vyber) potvrdVolbu();
      return;
    }
    if (k === 'skok' && !e.repeat) bufferSkoku = BUFFER;
    if (jizda && jizda.faze === 'nabidka' && !e.repeat) poJizde(e.code);
    else if (jizda && k !== 'skok' && !e.repeat) slapni(k);
    if (stena && !e.repeat) tahNaStene(e.code === 'Space' ? 'cvak' : k === 'skok' ? 'nahoru' : k);
    klavesy[k] = true;
  });
  okno.addEventListener('keyup', function (e) {
    var k = KLAVESY[e.code];
    if (!k) return;
    klavesy[k] = false;
    // Krátký stisk = nižší skok.
    if (k === 'skok' && hrac && hrac.vy < 0) hrac.vy *= ZKRACENI;
  });
  okno.addEventListener('focusout', function (e) {
    if (!okno.contains(e.relatedTarget)) pauza();
  });
  // Panel leží přes celé plátno: v pauze hru obnoví klik kamkoli na něj,
  // jinak (úvod, konec) jen tlačítko.
  panel.addEventListener('click', function (e) {
    if (rezim === 'pauza' || e.target.closest('button')) hrat();
  });

  document.addEventListener('visibilitychange', function () { if (document.hidden) pauza(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (z) { if (!z[0].isIntersecting) pauza(); }).observe(okno);
  }
  window.addEventListener('resize', zmerit);

  // Ladění: s ?hra=… v adrese je stav vidět z konzole přes HRA_LADENI().
  if (/[?&]hra=/.test(location.search)) {
    window.HRA_LADENI = function (simulujSekund) {
      // Krokování bez requestAnimationFrame (pro testy v headless prohlížeči).
      for (var i = 0; i < (simulujSekund || 0) / KROK; i++) aktualizuj(KROK);
      if (simulujSekund) vykresli();
      return { dan: dan, aja: aja, hrac: hrac === aja ? 'aja' : 'dan', volba: volba, zub: zub, rezim: rezim, stopa: stopa.length, scena: !!scena,
               hotovo: hotovo, jizda: jizda, stena: stena, cesta: CHYTY };
    };
  }

  // ---------- Start ----------
  ctx.imageSmoothingEnabled = false;
  okno.classList.add('pripravena');
  zmerit();
  novaHra();
  vykresli();
  ukazPanel('uvod');
})();
