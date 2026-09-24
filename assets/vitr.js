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
  var DOSAH_TUKNUTI = 320; // px, ťuknutí má širší záběr než kurzor
  var DOSAH_ZAVANU = 520;  // px, závan od scrollu je ještě širší
  var PRELET = 45;         // snímků, za kolik závan přeběhne celou louku
  var TUHOST = 0.06;       // jak rychle míří k cíli; víc = tvrdší
  var TLUMENI = 0.80;      // jak rychle doznívá; míň = dřív klid
  var KLID = 0.08;         // stupňů; pod tím je náklon neviditelný a uklidí se

  var SVGNS = 'http://www.w3.org/2000/svg';

  var HIT_ODPAL = 180;      // px, dost širší než samotný květ, ať stačí trefit i stonek
  var ODLET_TRVA = 1500;    // ms, jak dlouho vítr odnáší uvolněný kousek pryč
  var ODLET_VZDALENOST = 90;  // jednotek (normalizovaný prostor rostliny), hlavní směr doprava
  var NAVRAT_NEJDRIV = 6000;  // ms, nejkratší doba, než se rostlina vrátí
  var NAVRAT_ROZPTYL = 3000;  // ms, přidaný náhodný rozptyl (ať se nevrací všechny najednou)

  // Práh pro každý druh — kde na rostlině (v normalizovaných 0–100 jednotkách
  // od paty nahoru, viz tools/extrakce.py) končí "zůstává jako stonek" a
  // začíná "odlétá". Doladěno ručně přes tools/prahy.html; při změně výběru
  // druhů v tools/louka.py (DRUHY) je potřeba tabulku přegenerovat.
  var PRAHY = {
    k007: -59.5, k013: -77.3, k014: -79.1, k021: -68.5, k029: -78,
    k032: -74.6, k040: -60,   k042: -82.9, k044: -74.4, k055: -79.1,
    k058: -75.8, k068: -75.8, k071: -70.5, k072: -78.9, k076: -68.4,
    k083: -83.1, k084: -78,   k088: -105,  k090: -81.6, k091: -71.3,
    k092: -77.9, k096: -71.5, k099: -59.5, k101: -77.4, k102: -73.2,
    k103: -64.3, k104: -80.1, k106: -71.1, k109: -84
  };

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
      var use = el.querySelector('use');
      var href = use ? (use.getAttribute('href') || use.getAttribute('xlink:href')) : null;
      return {
        el: el,
        use: use,
        druh: href ? href.slice(1) : null,  // "k007" apod. — pro PRAHY při odfouknutí
        sila: vpredu ? 1 : 0.5,   // zadní vrstva je dál, ohne se míň
        x: 0,
        mimo: false,
        uhel: 0,
        rychlost: 0,
        zapsano: 0,
        odpaleno: false
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
        // Louka je širší než okno (viewBox 10:1, ořezaný na boky), takže
        // část rostlin zůstává mimo záběr. V DOM jsou pořád, ale počítat
        // je nemá smysl — z 96 jich tím ubyde zhruba polovina.
        s.mimo = s.x < -60 || s.x > sirka + 60;
        if (s.mimo && s.zapsano !== 0) {
          s.el.style.transform = '';
          s.uhel = s.rychlost = s.zapsano = 0;
        }
      });
    }

    zmerit();

    var kurzor = { x: null, rychlost: 0 };
    // Závan má vlastní dosah a může putovat — proto posun. Bez něj by
    // scroll rozhýbal jen okolí jednoho bodu místo celé louky.
    var poryv = { x: 0, sila: 0, smer: 1, dosah: DOSAH_TUKNUTI, posun: 0, utlum: 0.93 };
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
        if (s.mimo || s.odpaleno) continue;
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
          if (dp < poryv.dosah) {
            cil += poryv.smer * MAX_UHEL * poryv.sila *
                   (1 - dp / poryv.dosah) * s.sila;
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

      poryv.x += poryv.posun;
      poryv.sila *= poryv.utlum;

      // Louka je širší než okno a přečnívající rostliny zůstávají v DOM.
      // Jakmile závan přeletí za okraj, zhasne — jinak by dál hýbal tím,
      // co stejně není vidět.
      if (poryv.posun !== 0 &&
          (poryv.x > sirka + poryv.dosah || poryv.x < -poryv.dosah)) {
        poryv.sila = 0;
        poryv.posun = 0;
      }
      kurzor.rychlost *= 0.82;

      // Pár snímků klidu navíc, ať smyčka neskáče mezi během a spánkem.
      klidnychSnimku = neco_se_hybe ? 0 : klidnychSnimku + 1;
      if (klidnychSnimku > 8) {
        bezi = false;
        return;
      }
      requestAnimationFrame(snimek);
    }

    /* ---------- odfouknutí ----------

       Kliknutí/ťuknutí blízko konkrétní rostliny jí "odfoukne" vršek —
       květ a listy odlétnou, stonek zůstane, a po chvíli rostlina zase
       naroste. `<use>` sdílí definici se všemi rostlinami stejného druhu,
       takže jednu instanci samostatně animovat nejde — při odpálení se
       proto `<use>` nahradí kopií cest z <defs>, každá cesta zvlášť.

       Rozdělení na "zůstává"/"odlétá" počítá stejně jako tools/prahy.html:
       změří se skutečně vykreslená poloha cesty (getBoundingClientRect) a
       převede zpátky do normalizovaného prostoru rostliny (0–100 jednotek
       od paty) přes inverzní CTM obalu, který nese měřítko instance. Číst
       to přímo z `d` atributu nejde — souřadnice tam jsou v původních
       jednotkách plátu, ne v normalizovaných. */

    function bodDo(bod, invM) {
      return bod.matrixTransform(invM);
    }

    function odpal(s) {
      if (s.mimo || s.odpaleno || !s.use || !s.druh) return;
      var prah = PRAHY[s.druh];
      if (prah == null) return;  // druh bez doladěného prahu se neodpaluje

      var def = svg.querySelector('#' + s.druh);
      if (!def) return;
      var normTransform = def.getAttribute('transform') || '';

      var puvodniUse = s.use;
      var klonDefinice = def.cloneNode(true);
      klonDefinice.removeAttribute('id');

      var obal = document.createElementNS(SVGNS, 'g');
      obal.setAttribute('transform', puvodniUse.getAttribute('transform') || '');
      obal.appendChild(klonDefinice);
      s.el.replaceChild(obal, puvodniUse);

      s.el.style.transform = '';
      s.uhel = s.rychlost = s.zapsano = 0;
      s.odpaleno = true;

      var invM = obal.getScreenCTM().inverse();

      var cesty = Array.prototype.slice.call(klonDefinice.querySelectorAll('path'));
      cesty.forEach(function (p) {
        var r = p.getBoundingClientRect();
        var bod1 = svg.createSVGPoint(); bod1.x = r.left; bod1.y = r.top;
        var bod2 = svg.createSVGPoint(); bod2.x = r.right; bod2.y = r.bottom;
        var a = bodDo(bod1, invM), b = bodDo(bod2, invM);
        var stred = (Math.min(a.y, b.y) + Math.max(a.y, b.y)) / 2;
        if (stred >= prah) return;  // pod prahem — zůstává jako stonek

        // Vlastní <g> bez transformu, zavěšený rovnou do `obal` (normalizovaný
        // prostor rostliny) — jen tam má CSS transform v px stejný měřítkový
        // základ jako práh. O patro níž, uvnitř klonDefinice, by "px" znamenal
        // jednotky plátu před měřítkem druhu, a rozptyl by byl neúměrně malý.
        var drzak = document.createElementNS(SVGNS, 'g');
        drzak.setAttribute('transform', normTransform);
        drzak.appendChild(p);
        var krouzek = document.createElementNS(SVGNS, 'g');
        krouzek.appendChild(drzak);
        obal.appendChild(krouzek);

        if (typeof krouzek.animate !== 'function') {
          krouzek.style.display = 'none';
          return;
        }

        // Vítr vždycky odnáší doprava a mírně vzhůru — ne od kliknutí na
        // všechny strany, to působilo jako výbuch, ne jako závan.
        var dx = ODLET_VZDALENOST * (0.6 + Math.random() * 0.8);
        var dy = -dx * (0.15 + Math.random() * 0.25);
        var rotace = (Math.random() * 2 - 1) * 100;
        var zpozdeni = Math.random() * 200;
        var doba = ODLET_TRVA + Math.random() * 500;

        var stred_x = (dx * 0.7).toFixed(1), stred_y = (dy * 0.7).toFixed(1);
        var animace = krouzek.animate([
          { transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + stred_x + 'px,' + stred_y + 'px) rotate(' + (rotace * 0.7).toFixed(0) + 'deg)', opacity: 1, offset: 0.7 },
          { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + rotace.toFixed(0) + 'deg)', opacity: 0 }
        ], { duration: doba, delay: zpozdeni, easing: 'ease-out', fill: 'forwards' });

        animace.onfinish = function () { krouzek.style.display = 'none'; };
      });

      var zaKolik = NAVRAT_NEJDRIV + Math.random() * NAVRAT_ROZPTYL;
      setTimeout(function () { navrat(s, obal, puvodniUse); }, zaKolik);
    }

    function navrat(s, obal, puvodniUse) {
      if (s.el.contains(obal)) {
        s.el.replaceChild(puvodniUse, obal);
      }
      s.odpaleno = false;
      if (typeof s.el.animate === 'function') {
        s.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out' });
      }
    }

    /* ---------- vstupy ----------

       Posluchače nesedí na louce, ale na celém heroi. Louka má v CSS
       pointer-events: none, aby nepřekážela výběru textu — takže by na ni
       žádná událost myši nedošla. Navíc je tím vítr citlivější: stačí
       přejet heroem a tráva pod textem zareaguje. */

    var plocha = svg.closest ? svg.closest('.hero') : null;
    if (!plocha) plocha = svg.parentNode;

    var posledniX = null;

    plocha.addEventListener('pointermove', function (u) {
      var x = u.clientX - svg.getBoundingClientRect().left;
      if (posledniX !== null) {
        kurzor.rychlost = Math.max(kurzor.rychlost, Math.abs(x - posledniX) * 60);
      }
      posledniX = x;
      kurzor.x = x;
      probudit();
    }, { passive: true });

    plocha.addEventListener('pointerleave', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });

    // Na dotyku hover neexistuje: po zvednutí prstu se musí kurzor zrušit,
    // jinak by louka zůstala ohnutá v místě posledního doteku.
    plocha.addEventListener('pointerup', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });
    plocha.addEventListener('pointercancel', function () {
      kurzor.x = null;
      posledniX = null;
      probudit();
    }, { passive: true });

    plocha.addEventListener('pointerdown', function (u) {
      var klikX = u.clientX - svg.getBoundingClientRect().left;
      poryv.x = klikX;
      poryv.sila = 1;
      poryv.smer = poryv.x > sirka / 2 ? -1 : 1;
      probudit();

      var nejblizsi = null, nejmensi = HIT_ODPAL;
      for (var i = 0; i < stav.length; i++) {
        var s = stav[i];
        if (s.mimo || s.odpaleno) continue;
        var d = Math.abs(s.x - klikX);
        if (d < nejmensi) { nejmensi = d; nejblizsi = s; }
      }
      if (nejblizsi) odpal(nejblizsi);
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

        var sila = Math.min(Math.abs(zmena) / 45, 0.85);

        // Běžící závan se jen přiživí. Kdyby se přenastavoval při každé
        // události scrollu, pořád by startoval od kraje a nikam by nedoběhl.
        if (poryv.sila > 0.25 && poryv.posun !== 0) {
          poryv.sila = Math.max(poryv.sila, sila);
          probudit();
          return;
        }

        // Závan přeletí přes celou louku, jinak se hýbe jen její střed.
        var doprava = zmena > 0;
        poryv.x = doprava ? -DOSAH_ZAVANU * 0.5 : sirka + DOSAH_ZAVANU * 0.5;
        poryv.posun = (sirka + DOSAH_ZAVANU) / PRELET * (doprava ? 1 : -1);
        poryv.dosah = DOSAH_ZAVANU;
        poryv.smer = doprava ? 1 : -1;
        // Doznívá pomaleji než ťuknutí — musí vydržet celý přelet.
        poryv.utlum = 0.985;
        poryv.sila = Math.max(poryv.sila, sila);
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
