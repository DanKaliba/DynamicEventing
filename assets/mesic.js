/* ==========================================================================
   Měsíc nad loukou — skutečná fáze a poloha pro Himmelreich

   Poloha i fáze se počítají pro aktuální okamžik (nebo pro ?cas= / ?dnes=
   / posuvník v panelu oblohy — hodinu bere z data-hodina, které nastavuje
   assets/obloha.js). Vychází vlevo (východ), přejde oblohou a zapadá
   vpravo (západ); výška nad obzorem odpovídá skutečné.

   Ve dne je bledý a průsvitný, v noci jasný se září a u obzoru do oranžova.
   Obzor je spodní hrana hera — nízko stojící Měsíc prosvítá mezi kytkami.

   Výpočet je zkrácený (hlavní členy teorie Měsíce, bez paralaxy), přesnost
   kolem stupně — na obrázek oblohy víc než dost.
   ========================================================================== */

(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  if (!hero || !document.createElementNS) return;

  var LAT = 50.8019203, LON = 14.0456936;   // Himmelreich, viz tools/mapa.py
  var AZ_VLEVO = 40, AZ_VPRAVO = 320;        // azimut na levém a pravém okraji
  var VYSKA_NAHORE = 70;                     // stupně výšky u horního okraje

  var rad = Math.PI / 180;
  var NS = 'http://www.w3.org/2000/svg';
  var koren = document.documentElement;

  function sin(x) { return Math.sin(x * rad); }
  function cos(x) { return Math.cos(x * rad); }

  function pozice(datum) {
    var d = datum.getTime() / 86400000 + 2440587.5 - 2451545.0;

    var gs = 357.529 + 0.98560028 * d;
    var slunceL = 280.459 + 0.98564736 * d + 1.915 * sin(gs) + 0.020 * sin(2 * gs);

    var L = 218.316 + 13.176396 * d;
    var M = 134.963 + 13.064993 * d;
    var F = 93.272 + 13.229350 * d;
    var D = 297.850 + 12.190749 * d;
    var mesicL = L + 6.289 * sin(M) + 1.274 * sin(2 * D - M) + 0.658 * sin(2 * D) +
                 0.214 * sin(2 * M) - 0.186 * sin(gs) - 0.114 * sin(2 * F);
    var mesicB = 5.128 * sin(F);

    var eps = 23.439 - 0.0000004 * d;
    var gmst = 280.46061837 + 360.98564736629 * d;

    function vyskaAzimut(lam, beta) {
      var ra = Math.atan2(sin(lam) * cos(eps) - Math.tan(beta * rad) * sin(eps), cos(lam)) / rad;
      var dec = Math.asin(sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lam)) / rad;
      var h = gmst + LON - ra;
      var alt = Math.asin(sin(LAT) * sin(dec) + cos(LAT) * cos(dec) * cos(h)) / rad;
      var az = Math.atan2(-sin(h) * cos(dec), cos(LAT) * sin(dec) - sin(LAT) * cos(dec) * cos(h)) / rad;
      return { alt: alt, az: ((az % 360) + 360) % 360 };
    }

    var elongace = (((mesicL - slunceL) % 360) + 360) % 360;
    return {
      mesic: vyskaAzimut(mesicL, mesicB),
      slunce: vyskaAzimut(slunceL, 0),
      osvetleno: (1 - cos(elongace)) / 2,
      dorusta: elongace < 180
    };
  }

  // Okamžik, pro který se kreslí: dnešek (nebo ?dnes=) v hodinu z obloha.js.
  function okamzik() {
    var h = parseFloat(koren.getAttribute('data-hodina'));
    var z = /[?&]dnes=(\d{4})-(\d{2})-(\d{2})(?:&|$)/.exec(location.search);
    var ted = new Date();
    if (isNaN(h) && !z) return ted;
    var den = z ? new Date(+z[1], +z[2] - 1, +z[3]) : new Date(ted.getFullYear(), ted.getMonth(), ted.getDate());
    if (isNaN(h)) h = ted.getHours() + ted.getMinutes() / 60;
    return new Date(den.getTime() + h * 3600000);
  }

  function el(jmeno, atributy, rodic) {
    var e = document.createElementNS(NS, jmeno);
    Object.keys(atributy).forEach(function (k) { e.setAttribute(k, atributy[k]); });
    if (rodic) rodic.appendChild(e);
    return e;
  }

  var svg = el('svg', { 'class': 'mesic', viewBox: '-2 -2 4 4', 'aria-hidden': 'true', focusable: 'false' });
  var defs = el('defs', {}, svg);
  var gradient = el('radialGradient', { id: 'mesic-zare' }, defs);
  el('stop', { offset: '0.3', 'stop-color': '#FFF6DC', 'stop-opacity': '0.45' }, gradient);
  el('stop', { offset: '1', 'stop-color': '#FFF6DC', 'stop-opacity': '0' }, gradient);
  var zare = el('circle', { r: '2', fill: 'url(#mesic-zare)' }, svg);
  var tma = el('circle', { r: '1', fill: '#C8D2EA' }, svg);   // popelavý svit neosvětlené části
  var svetlo = el('path', {}, svg);

  var louka = hero.querySelector('.louka');
  hero.insertBefore(svg, louka || null);

  /* Osvětlená část: okraj na osvětlené straně + terminátor jako půlelipsa.
     Kreslí se dorůstající (osvětlená vpravo); couvající se zrcadlí. */
  function tvar(osvetleno, dorusta) {
    var rx = Math.abs(1 - 2 * osvetleno).toFixed(3);
    var vypoukly = osvetleno > 0.5 ? 1 : 0;
    var d = 'M0,-1 A1,1 0 0 1 0,1 A' + rx + ',1 0 0 ' + vypoukly + ' 0,-1Z';
    svetlo.setAttribute('d', d);
    svetlo.setAttribute('transform', dorusta ? '' : 'scale(-1,1)');
  }

  function michat(a, b, t) {
    var x = [1, 3, 5].map(function (i) {
      var va = parseInt(a.slice(i, i + 2), 16), vb = parseInt(b.slice(i, i + 2), 16);
      return ('0' + Math.round(va + (vb - va) * t).toString(16)).slice(-2);
    });
    return '#' + x.join('');
  }

  function omezit(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* Kde v heru leží text — těsně kolem řádků (Range), ne kolem celých
     bloků: <h1> je blok přes celou šířku, ale jména zabírají jen levou
     část a vpravo od nich je pro Měsíc místo. Relativně k heru. */
  function obdelnikTextu(r) {
    var o = null;
    Array.prototype.forEach.call(hero.querySelectorAll('.hero-text h1, .hero-text p'), function (e) {
      if (e.hidden) return;
      var rozsah = document.createRange();
      rozsah.selectNodeContents(e);
      var b = rozsah.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (!o) o = { l: b.left, t: b.top, r: b.right, b: b.bottom };
      else {
        o.l = Math.min(o.l, b.left); o.t = Math.min(o.t, b.top);
        o.r = Math.max(o.r, b.right); o.b = Math.max(o.b, b.bottom);
      }
    });
    return o && { l: o.l - r.left, t: o.t - r.top, r: o.r - r.left, b: o.b - r.top };
  }

  /* Čitelnost má přednost před přesností: když by Měsíc (i se září) zasáhl
     do textu, posune se na nejbližší volné místo — vpravo, nad nebo pod
     text. Vrací null, když se nikam nevejde (úzký telefon). */
  function mimoText(x, y, polomer, r, nahore) {
    var t = obdelnikTextu(r);
    if (!t) return { x: x, y: y };
    var m = polomer * 1.5 + 10;
    var l = t.l - m, p = t.r + m, h = t.t - m, d = t.b + m;
    if (x < l || x > p || y < h || y > d) return { x: x, y: y };

    var moznosti = [{ x: p, y: y }, { x: l, y: y }, { x: x, y: h }, { x: x, y: d }]
      .filter(function (k) {
        return k.x >= polomer && k.x <= r.width - polomer && k.y >= nahore && k.y <= r.height;
      });
    if (!moznosti.length) return null;
    moznosti.sort(function (a, b) {
      return Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y);
    });
    return moznosti[0];
  }

  function prekreslit() {
    var p = pozice(okamzik());
    var m = p.mesic;
    var r = hero.getBoundingClientRect();

    if (m.alt < -2 || m.az < AZ_VLEVO - 5 || m.az > AZ_VPRAVO + 5) {
      svg.style.display = 'none';
      return;
    }
    svg.style.display = '';

    var polomer = omezit(r.width * 0.018, 14, 28);
    var nahore = 64 + polomer;  // pod navigací
    var x = (m.az - AZ_VLEVO) / (AZ_VPRAVO - AZ_VLEVO) * r.width;
    var y = r.height - omezit(m.alt / VYSKA_NAHORE, 0, 1) * (r.height - nahore);

    var misto = mimoText(x, y, polomer, r, nahore);
    if (!misto) {
      svg.style.display = 'none';
      return;
    }
    x = misto.x;
    y = misto.y;

    svg.style.width = svg.style.height = (polomer * 4) + 'px';
    svg.style.left = (x - polomer * 2) + 'px';
    svg.style.top = (y - polomer * 2) + 'px';

    tvar(p.osvetleno, p.dorusta);

    // 0 = noc (Slunce pod -6°), 1 = den (nad +2°), mezi tím soumrak.
    var den = omezit((p.slunce.alt + 6) / 8, 0, 1);
    // Nízko nad obzorem do oranžova — v noci víc, ve dne skoro vůbec.
    var oranz = omezit((12 - m.alt) / 12, 0, 1) * (1 - den * 0.8);
    svetlo.setAttribute('fill', michat(den > 0.5 ? '#FFFFFF' : '#F6F1E1', '#FFC98A', oranz * 0.7));
    svetlo.setAttribute('opacity', (1 - den * 0.5).toFixed(2));
    zare.setAttribute('opacity', (1 - den).toFixed(2));
    tma.setAttribute('opacity', (0.08 * (1 - den)).toFixed(3));
  }

  prekreslit();
  // data-jazyk: anglický text je jinak dlouhý, volné místo se mění.
  new MutationObserver(prekreslit).observe(koren, { attributes: true, attributeFilter: ['data-hodina', 'data-jazyk'] });
  // Webové písmo dorazí až po prvním vykreslení a změní šířku řádků.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(prekreslit);

  var zmenaCeka;
  window.addEventListener('resize', function () {
    clearTimeout(zmenaCeka);
    zmenaCeka = setTimeout(prekreslit, 200);
  }, { passive: true });
})();
