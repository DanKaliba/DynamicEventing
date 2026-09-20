/* ==========================================================================
   Vítr v louce

   Louka je ve stránce jako <img>, což je plochý obrázek — dovnitř se
   nedostane myš ani skript. Tenhle soubor ji po načtení stáhne a vloží
   do DOMu jako živé SVG. Když cokoli selže (vypnutý JS, otevření souboru
   přes file://, starý prohlížeč), zůstane obrázek a stránka vypadá stejně,
   jen se nehýbe.

   Tři vstupy, všechny přes Pointer Events, takže jeden kód obslouží myš,
   pero i prst:
     pohyb    — rostliny se ohýbají od kurzoru, silněji zblízka
     ťuknutí  — poryv z jednoho místa, rozbíhá se do stran a doběhne
     scroll   — zhoupnutí podle rychlosti; na mobilu jediné, co uživatel
                udělá vždycky

   Trvalé kývání na pozadí tu schválně není. Louka je v hero, byla by
   pořád na obrazovce a 96 nepřetržitě animovaných prvků zbytečně žere
   baterku. Pohyb je vždycky odpověď na akci.
   ========================================================================== */

(function () {
  'use strict';

  /* Čísla pružiny nejsou od oka — rekurence níž se dá přehrát snímek po
     snímku a změřit. Tyhle dávají náběh 0,13 s, překmit 18 % a klid po
     0,40 s, což na trávu vypadá měkce. Tužší kombinace (0,22/0,68) se
     usadí za 0,18 s, ale pohyb pak působí spíš mechanicky.

     Pozor: kvůli tomu překmitu vyjede úhel o pětinu nad MAX_UHEL, takže
     skutečné maximum je ~5,3°. */
  var MAX_UHEL = 4.5;      // stupňů, cíl pro rostlinu přímo u kurzoru
  var DOSAH = 230;         // px, dokam kurzor dosáhne
  var DOSAH_PORYVU = 320;  // px, ťuknutí má širší záběr než kurzor
  var TUHOST = 0.06;       // jak rychle míří k cíli; víc = tvrdší
  var TLUMENI = 0.80;      // jak rychle doznívá; míň = dřív klid
  var KLID = 0.08;         // stupňů; pod tím je náklon neviditelný a uklidí se

  var obrazek = document.querySelector('img.louka');
  if (!obrazek || !window.fetch || !window.requestAnimationFrame) return;

  // Kdo má v systému vypnuté animace, dostane rovnou statický obrázek.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  fetch(obrazek.getAttribute('src'))
    .then(function (odpoved) {
      if (!odpoved.ok) throw new Error(odpoved.status);
      return odpoved.text();
    })
    .then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      var svg = doc.documentElement;
      if (!svg || svg.nodeName !== 'svg' || svg.querySelector('parsererror')) return;

      // Louka je dekorace; odečítače obrazovky ji mají přeskočit.
      svg.setAttribute('class', 'louka louka-ziva');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.removeAttribute('role');
      svg.removeAttribute('aria-label');

      obrazek.parentNode.replaceChild(document.adoptNode(svg), obrazek);
      rozhybat(svg);
    })
    .catch(function () {
      // Obrázek zůstane. Nejčastější případ: otevřeno přes file://,
      // kde prohlížeč fetch na sousední soubor nepovolí.
    });

  function rozhybat(svg) {
    var kytky = Array.prototype.slice.call(svg.querySelectorAll('.kytka'));
    if (!kytky.length) return;

    var stav = kytky.map(function (el) {
      var vrstva = el.parentNode && el.parentNode.parentNode;
      var vpredu = vrstva && vrstva.getAttribute('class') === 'vrstva-predni';
      return {
        el: el,
        sila: vpredu ? 1 : 0.5,   // zadní vrstva je dál, ohne se míň
        x: 0,
        uhel: 0,
        rychlost: 0,
        zapsano: 0
      };
    });

    var sirka = 0;

    function zmerit() {
      // Měří se v klidovém stavu — s nakloněnými rostlinami by obalové
      // obdélníky lhaly.
      var ramec = svg.getBoundingClientRect();
      sirka = ramec.width;
      stav.forEach(function (s) {
        var b = s.el.getBoundingClientRect();
        s.x = b.left + b.width / 2 - ramec.left;
      });
    }

    zmerit();

    var kurzor = { x: null, rychlost: 0 };
    var poryv = { x: 0, sila: 0, smer: 1 };
    var bezi = false;
    var klidnychSnimku = 0;

    function probudit() {
      klidnychSnimku = 0;
      if (!bezi) {
        bezi = true;
        requestAnimationFrame(snimek);
      }
    }

    function snimek() {
      var neco_se_hybe = false;

      for (var i = 0; i < stav.length; i++) {
        var s = stav[i];
        var cil = 0;

        if (kurzor.x !== null) {
          var d = Math.abs(s.x - kurzor.x);
          if (d < DOSAH) {
            // Druhá mocnina: blízko kurzoru prudce, dál rychle mizí.
            var podil = 1 - d / DOSAH;
            // Rostliny se uhýbají od kurzoru; rychlý pohyb přidá na síle.
            var smer = s.x < kurzor.x ? -1 : 1;
            cil += smer * MAX_UHEL * podil * podil *
                   (0.45 + Math.min(kurzor.rychlost / 900, 0.55)) * s.sila;
          }
        }

        if (poryv.sila > 0.01) {
          var dp = Math.abs(s.x - poryv.x);
          if (dp < DOSAH_PORYVU) {
            cil += poryv.smer * MAX_UHEL * poryv.sila *
                   (1 - dp / DOSAH_PORYVU) * s.sila;
          }
        }

        // Rostlina v klidu, na kterou nic netlačí, se přeskakuje —
        // jinak by se každý snímek počítalo všech 96.
        if (cil === 0 && Math.abs(s.uhel) < KLID && Math.abs(s.rychlost) < KLID) {
          if (s.zapsano !== 0) {
            s.el.style.transform = '';
            s.zapsano = 0;
            s.uhel = 0;
            s.rychlost = 0;
          }
          continue;
        }

        // Tlumená pružina. Přestřelí a vrátí se — z toho je to zhoupnutí.
        s.rychlost = (s.rychlost + (cil - s.uhel) * TUHOST) * TLUMENI;
        s.uhel += s.rychlost;
        neco_se_hybe = true;

        if (Math.abs(s.uhel - s.zapsano) > 0.04) {
          s.el.style.transform = 'rotate(' + s.uhel.toFixed(2) + 'deg)';
          s.zapsano = s.uhel;
        }
      }

      poryv.sila *= 0.93;
      kurzor.rychlost *= 0.82;

      // Pár snímků klidu navíc, ať smyčka neskáče mezi během a spánkem.
      klidnychSnimku = neco_se_hybe ? 0 : klidnychSnimku + 1;
      if (klidnychSnimku > 8) {
        bezi = false;
        return;
      }
      requestAnimationFrame(snimek);
    }

    /* ---------- vstupy ---------- */

    var posledniX = null;

    svg.addEventListener('pointermove', function (u) {
      var x = u.clientX - svg.getBoundingClientRect().left;
      if (posledniX !== null) {
        kurzor.rychlost = Math.max(kurzor.rychlost, Math.abs(x - posledniX) * 60);
      }
      posledniX = x;
      kurzor.x = x;
      probudit();
    }, { passive: true });

    svg.addEventListener('pointerleave', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });

    // Na dotyku hover neexistuje: po zvednutí prstu se musí kurzor zrušit,
    // jinak by louka zůstala ohnutá v místě posledního doteku.
    svg.addEventListener('pointerup', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });
    svg.addEventListener('pointercancel', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });

    svg.addEventListener('pointerdown', function (u) {
      poryv.x = u.clientX - svg.getBoundingClientRect().left;
      poryv.sila = 1;
      poryv.smer = poryv.x > sirka / 2 ? -1 : 1;
      probudit();
    }, { passive: true });

    /* Scroll. Na mobilu jediné, co udělá úplně každý — bez toho by se
       o větru dotykový návštěvník nedozvěděl. Poryv jde přes celou šířku,
       proto se nastaví doprostřed a s velkou silou. */
    var posledniScroll = window.pageYOffset;
    var scrollCeka = false;

    window.addEventListener('scroll', function () {
      if (scrollCeka) return;
      scrollCeka = true;
      requestAnimationFrame(function () {
        scrollCeka = false;
        var ted = window.pageYOffset;
        var zmena = ted - posledniScroll;
        posledniScroll = ted;

        var ramec = svg.getBoundingClientRect();
        var vidno = ramec.bottom > 0 && ramec.top < window.innerHeight;
        if (!vidno || Math.abs(zmena) < 2) return;

        poryv.x = sirka / 2;
        poryv.smer = zmena > 0 ? -1 : 1;
        poryv.sila = Math.max(poryv.sila, Math.min(Math.abs(zmena) / 45, 0.85));
        probudit();
      });
    }, { passive: true });

    var zmenaCeka;
    window.addEventListener('resize', function () {
      clearTimeout(zmenaCeka);
      zmenaCeka = setTimeout(function () {
        // Než se měří, musí být všechny rostliny rovně.
        stav.forEach(function (s) {
          s.el.style.transform = '';
          s.uhel = s.rychlost = s.zapsano = 0;
        });
        zmerit();
      }, 200);
    }, { passive: true });
  }
})();
