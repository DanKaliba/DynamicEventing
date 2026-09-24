/* ==========================================================================
   Svatba na Himmelreichu — chování stránky

   Vanilla JS, žádné závislosti. Bez něj stránka funguje dál, jen bez
   odpočtu, lightboxu a přepínače motivu — proto je odpočet v HTML
   schovaný a odkrývá ho až skript.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Světlý a tmavý motiv ----------
     Cílená třída, ne obecná .prepinac — tu teď sdílí i jazykový
     přepínač kvůli společnému vzhledu, a querySelector('.prepinac')
     by vrátil první z nich v DOM pořadí, ne nutně tenhle. Přesně tahle
     záměna byla příčina, proč přepínač motivu přestal fungovat a klik
     na jazykové tlačítko místo toho přepínal obojí najednou. */
  var prepinac = document.querySelector('.prepinac-motiv');

  if (prepinac) {
    prepinac.addEventListener('click', function () {
      var koren = document.documentElement;
      var ted = koren.getAttribute('data-theme');

      // Bez vynuceného motivu se vychází ze systémového nastavení.
      if (!ted) {
        ted = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      var dalsi = ted === 'dark' ? 'light' : 'dark';
      koren.setAttribute('data-theme', dalsi);

      try {
        localStorage.setItem('motiv', dalsi);
      } catch (e) {
        // Soukromé okno nebo zakázaná úložiště — motiv vydrží do reloadu.
      }
    });
  }

  /* ---------- Čeština a angličtina ----------
     Text tlačítka je cílový jazyk (na co přepne), ne aktuální — proto
     se po každém kliku přepíše na tu druhou zkratku. */

  var prepinacJazyka = document.querySelector('.prepinac-jazyk');

  function nastavJazyk(jazyk, ulozit) {
    var koren = document.documentElement;
    koren.setAttribute('data-jazyk', jazyk);
    koren.lang = jazyk;
    if (prepinacJazyka) {
      prepinacJazyka.textContent = jazyk === 'en' ? 'CZ' : 'EN';
      prepinacJazyka.setAttribute('data-jazyk-cil', jazyk === 'en' ? 'cs' : 'en');
      prepinacJazyka.setAttribute('aria-label',
        jazyk === 'en' ? 'Přepnout do češtiny' : 'Switch to English');
    }
    if (ulozit) {
      try {
        localStorage.setItem('jazyk', jazyk);
      } catch (e) {
        // Soukromé okno nebo zakázaná úložiště — jazyk vydrží do reloadu.
      }
    }
  }

  if (prepinacJazyka) {
    // Tlačítko v HTML má natvrdo "EN" — dosaď správný text i pro
    // stránku načtenou rovnou s uloženou angličtinou (viz skript v
    // <head>, který data-jazyk nastaví ještě před vykreslením).
    nastavJazyk(document.documentElement.getAttribute('data-jazyk') === 'en' ? 'en' : 'cs', false);

    prepinacJazyka.addEventListener('click', function () {
      nastavJazyk(prepinacJazyka.getAttribute('data-jazyk-cil'), true);
    });
  }

  /* ---------- Odpočet ---------- */

  var odpocet = document.querySelector('.odpocet');

  if (odpocet) {
    var cil = new Date(odpocet.getAttribute('data-datum')).getTime();
    var poleDni = odpocet.querySelector('[data-dni]');

    if (!isNaN(cil) && cil > Date.now()) {
      // Dny, ne hodiny a minuty. Na svatbu vzdálenou rok je vteřinový
      // odpočet jen hluk a nutí stránku přepisovat se každou vteřinu.
      poleDni.textContent = Math.ceil((cil - Date.now()) / 86400000);
      odpocet.hidden = false;
    }
  }

  /* ---------- Navigace: tmavá nad heroem, světlá po odscrollování ---------- */

  var nav = document.querySelector('.nav');
  var hero = document.querySelector('.hero');

  if (nav && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (zaznamy) {
      nav.classList.toggle('odscrollovano', !zaznamy[0].isIntersecting);
    }, { rootMargin: '-56px 0px 0px 0px' }).observe(hero);
  }

  /* ---------- Zvýraznění sekce, ve které právě jsme ---------- */

  var odkazy = Array.prototype.slice.call(document.querySelectorAll('.nav-odkazy a'));

  if (odkazy.length && 'IntersectionObserver' in window) {
    var odkazProId = {};
    var sekce = [];

    odkazy.forEach(function (odkaz) {
      var cilova = document.querySelector(odkaz.getAttribute('href'));
      if (cilova) {
        odkazProId[cilova.id] = odkaz;
        sekce.push(cilova);
      }
    });

    var videt = {};

    var pozorovatel = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        videt[z.target.id] = z.isIntersecting;
      });

      // Aktivní je první sekce shora, která je zrovna vidět.
      var aktivni = null;
      for (var i = 0; i < sekce.length; i++) {
        if (videt[sekce[i].id]) {
          aktivni = sekce[i].id;
          break;
        }
      }

      odkazy.forEach(function (odkaz) {
        odkaz.removeAttribute('aria-current');
      });

      if (aktivni && odkazProId[aktivni]) {
        odkazProId[aktivni].setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-72px 0px -55% 0px' });

    sekce.forEach(function (s) {
      pozorovatel.observe(s);
    });
  }

  /* ---------- Galerie a lightbox ---------- */

  var fotky = window.GALERIE || [];
  var mrizka = document.getElementById('galerie');
  var prazdno = document.getElementById('galerie-prazdno');

  if (!mrizka || !fotky.length) return;

  mrizka.hidden = false;
  if (prazdno) prazdno.hidden = true;

  fotky.forEach(function (fotka, poradi) {
    var tlacitko = document.createElement('button');
    tlacitko.type = 'button';
    tlacitko.setAttribute('aria-label', 'Zvětšit fotku: ' + fotka.popis);

    var obrazek = document.createElement('img');
    obrazek.src = fotka.src;
    obrazek.alt = fotka.popis;
    obrazek.loading = 'lazy';
    obrazek.decoding = 'async';
    if (fotka.sirka && fotka.vyska) {
      obrazek.width = fotka.sirka;
      obrazek.height = fotka.vyska;
    }

    tlacitko.appendChild(obrazek);
    tlacitko.addEventListener('click', function () {
      otevrit(poradi);
    });

    mrizka.appendChild(tlacitko);
  });

  var lightbox = document.getElementById('lightbox');
  var lbObrazek = document.getElementById('lb-obrazek');
  var lbPocet = document.getElementById('lb-pocet');
  var aktualni = 0;
  var predchoziFokus = null;

  function ukazat(index) {
    // Modulo se zápornou hodnotou: z první fotky se doleva zalomí na poslední.
    aktualni = (index + fotky.length) % fotky.length;
    lbObrazek.src = fotky[aktualni].src;
    lbObrazek.alt = fotky[aktualni].popis;
    lbPocet.textContent = (aktualni + 1) + ' / ' + fotky.length;
  }

  function otevrit(index) {
    predchoziFokus = document.activeElement;
    ukazat(index);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lb-zavrit').focus();
  }

  function zavrit() {
    lightbox.hidden = true;
    lbObrazek.removeAttribute('src');
    document.body.style.overflow = '';
    if (predchoziFokus) predchoziFokus.focus();
  }

  lightbox.querySelector('.lb-zavrit').addEventListener('click', zavrit);
  lightbox.querySelector('.lb-predchozi').addEventListener('click', function () {
    ukazat(aktualni - 1);
  });
  lightbox.querySelector('.lb-dalsi').addEventListener('click', function () {
    ukazat(aktualni + 1);
  });

  // Klik na pozadí (ne na fotku ani tlačítka) zavírá.
  lightbox.addEventListener('click', function (udalost) {
    if (udalost.target === lightbox) zavrit();
  });

  document.addEventListener('keydown', function (udalost) {
    if (lightbox.hidden) return;
    if (udalost.key === 'Escape') zavrit();
    if (udalost.key === 'ArrowLeft') ukazat(aktualni - 1);
    if (udalost.key === 'ArrowRight') ukazat(aktualni + 1);
  });
})();
