/* ==========================================================================
   Obloha nad loukou podle denní doby návštěvníka

   Pozadí hera je přechod oblohy: nahoře `vrch`, u horní hrany louky
   `stred`, za loukou `obzor`. Barvy se plynule dopočítávají mezi opěrnými
   body dne (noc, svítání, den, západ, soumrak) podle místního času.

   Čitelnost se nekontroluje od oka, ale počítá: text v heru leží mezi
   `vrch` a `stred`, takže obě musí s textem splnit WCAG AA (4,5:1).
   Nejsytější barva svítání a západu je jen v `obzor` — za loukou, kde
   žádný text není. Když opěrné body nevyjdou (přechod modré dne do
   soumraku projde pásmem, kde nečte tmavý ani světlý text), skript
   `vrch` ztmaví/zesvětlí a `stred` přitáhne k `vrch`, dokud to neprojde.

   Na zkoušku:
     ?cas=6:30   nasimuluje libovolnou denní dobu
     ?panel      ovládací panel (assets/panel-oblohy.js) — posuvník času
                 a výběr barev; tabulku pak zkopíruje sem do OBLOHA

   Skript je v <head>, ať se barvy nastaví před prvním vykreslením.
   Bez JS platí denní obloha z :root ve style.css.
   ========================================================================== */

(function () {
  'use strict';

  // [hodina, vrch, obzor, název]
  var OBLOHA = [
    [0,    '#0B1530', '#1E2C55', 'noc'],
    [4.5,  '#0B1530', '#1E2C55', 'noc'],
    [5.5,  '#2E3B78', '#E89AA0', 'svítání'],
    [6.5,  '#8DB0DD', '#FFD2A8', 'ráno'],
    [9,    '#8EC3EE', '#DDEFF8', 'dopoledne'],
    [13,   '#6FB2EC', '#D2EAF8', 'poledne'],
    [17,   '#82B8E8', '#EEF1E2', 'odpoledne'],
    [19.5, '#4F63A8', '#FFB27A', 'západ'],
    [20.5, '#2F356F', '#E8877C', 'červánky'],
    [21.5, '#16204A', '#5C4378', 'soumrak'],
    [22.5, '#0B1530', '#1E2C55', 'noc'],
    [24,   '#0B1530', '#1E2C55', 'noc']
  ];

  var TMAVY = [12, 26, 6];     // --les / --text
  var SVETLY = [243, 245, 236]; // --pozadi světlého motivu

  // Výchozí odstíny doplňkových barev; před použitím se přitáhnou
  // k hlavnímu textu, dokud nesplní kontrast.
  var ODSTINY = {
    tmavy:  { tlumeny: [73, 110, 22],  akcent: [143, 116, 12], aktivni: [204, 3, 14] },
    svetly: { tlumeny: [168, 182, 156], akcent: [242, 214, 92], aktivni: [242, 86, 79] }
  };

  var AA = 4.5;

  function rgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); });
  }

  function hex(c) {
    return '#' + c.map(function (v) {
      return ('0' + Math.round(v).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }

  function mix(a, b, t) {
    return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; });
  }

  function jas(c) {
    var k = c.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  }

  function kontrast(a, b) {
    var la = jas(a), lb = jas(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function obloha(hodina) {
    for (var i = 0; i < OBLOHA.length - 1; i++) {
      var a = OBLOHA[i], b = OBLOHA[i + 1];
      if (hodina >= a[0] && hodina <= b[0]) {
        var t = b[0] === a[0] ? 0 : (hodina - a[0]) / (b[0] - a[0]);
        return { vrch: mix(rgb(a[1]), rgb(b[1]), t), obzor: mix(rgb(a[2]), rgb(b[2]), t) };
      }
    }
    return { vrch: rgb(OBLOHA[0][1]), obzor: rgb(OBLOHA[0][2]) };
  }

  // Odkazy v navigaci mají opacity 0.75 a přepínače 0.6 — nad `vrch` se
  // proto kontroluje i barva po prosvitnutí pozadí, ne jen plný text.
  function citelnyVrch(text, vrch) {
    return kontrast(text, vrch) >= AA &&
           kontrast(mix(text, vrch, 0.25), vrch) >= AA &&
           kontrast(mix(text, vrch, 0.4), vrch) >= 3;
  }

  function doplnkova(odstin, text, pozadi) {
    for (var t = 0; t <= 1; t += 0.05) {
      var c = mix(odstin, text, t);
      if (pozadi.every(function (p) { return kontrast(c, p) >= AA; })) return c;
    }
    return text;
  }

  function spocitat(hodina) {
    var o = obloha(hodina);
    var svetlyText = kontrast(SVETLY, o.vrch) > kontrast(TMAVY, o.vrch);
    var text = svetlyText ? SVETLY : TMAVY;

    var vrch = o.vrch;
    var smer = svetlyText ? [0, 0, 0] : [255, 255, 255];
    for (var p = 0; p < 1 && !citelnyVrch(text, vrch); p += 0.02) {
      vrch = mix(o.vrch, smer, p);
    }

    var stred = mix(vrch, o.obzor, 0.5);
    for (var t = 0.5; t > 0 && kontrast(text, stred) < AA; t -= 0.05) {
      stred = mix(vrch, o.obzor, Math.max(t - 0.05, 0));
    }

    var pozadi = [vrch, stred];
    var odstiny = ODSTINY[svetlyText ? 'svetly' : 'tmavy'];
    return {
      css: {
        '--hero-bg': hex(vrch),
        '--hero-stred': hex(stred),
        '--hero-obzor': hex(o.obzor),
        '--hero-text': hex(text),
        '--hero-text-tlumeny': hex(doplnkova(odstiny.tlumeny, text, pozadi)),
        '--hero-akcent': hex(doplnkova(odstiny.akcent, text, pozadi)),
        '--hero-aktivni': hex(doplnkova(odstiny.aktivni, text, [vrch]))
      },
      // Pro panel: co z nastavených barev skript kvůli čitelnosti pozměnil.
      info: {
        puvodniVrch: hex(o.vrch),
        upravenVrch: hex(o.vrch) !== hex(vrch),
        kontrast: Math.min(kontrast(text, vrch), kontrast(text, stred))
      }
    };
  }

  var pevnaHodina = null;
  var m = /[?&]cas=(\d{1,2})(?::(\d{2}))?(?:&|$)/.exec(location.search);
  if (m && +m[1] < 24) pevnaHodina = +m[1] + (m[2] ? Math.min(+m[2], 59) / 60 : 0);

  function hodinaTed() {
    if (pevnaHodina !== null) return pevnaHodina;
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  function nastavit() {
    var barvy = spocitat(hodinaTed()).css;
    var styl = document.documentElement.style;
    Object.keys(barvy).forEach(function (k) { styl.setProperty(k, barvy[k]); });
  }

  nastavit();
  // Obloha se za pár minut změní jen nepatrně; častěji to nemá smysl.
  setInterval(nastavit, 5 * 60 * 1000);

  if (/[?&]panel(?:[=&]|$)/.test(location.search)) {
    window.Obloha = {
      tabulka: OBLOHA,
      spocitat: spocitat,
      hodina: hodinaTed,
      nastavitHodinu: function (h) { pevnaHodina = h; nastavit(); },
      prekreslit: nastavit
    };
    var s = document.createElement('script');
    s.src = 'assets/panel-oblohy.js';
    document.head.appendChild(s);
  }
})();
