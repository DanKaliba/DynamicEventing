/* ==========================================================================
   Vlaštovky přes denní oblohu

   Občas přes hero přeletí hejnko 1–3 vlaštovek: pár rychlých mávnutí,
   klouzání, sem tam střemhlav dolů k louce (lovení hmyzu nad trávou je
   pro ně typické). Mezi přelety se nic nekreslí a smyčka spí — trvalý
   pohyb by na denní obloze, která je na obrazovce pořád, zbytečně
   žral baterku.

   Den = bez data-noc na <html> (nastavuje assets/obloha.js). V noci
   létají světlušky (assets/svetlusky.js). Pod prefers-reduced-motion nic.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = document.querySelector('.hero');
  if (!hero) return;

  var PAUZA_OD = 6, PAUZA_DO = 16;   // s mezi přelety
  var BARVA = '#16213F';             // tmavě modročerná, jako hřbet vlaštovky

  var koren = document.documentElement;
  var platno = null, ctx = null;
  var sirka = 0, vyska = 0;
  var ptaci = [];
  var bezi = false, viditelny = true, casovac = null;
  var naposled = 0;

  function nahoda(a, b) { return a + Math.random() * (b - a); }

  function zmerit() {
    var r = hero.getBoundingClientRect();
    sirka = r.width;
    vyska = r.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    platno.width = Math.round(sirka * dpr);
    platno.height = Math.round(vyska * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function horniHranaLouky() {
    var louka = hero.querySelector('.louka');
    var h = hero.getBoundingClientRect();
    return louka ? louka.getBoundingClientRect().top - h.top : vyska * 0.8;
  }

  /* Silueta zespodu, letí ve směru +x, rozpětí 40 jednotek.
     `kridla` 1 = roztažená, menší = křídla ve švihu. */
  function nakreslit(x, y, uhel, rozpeti, kridla, pruhlednost) {
    var m = rozpeti / 40;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(uhel);
    ctx.scale(m, m);
    ctx.globalAlpha = pruhlednost;
    ctx.fillStyle = BARVA;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.3, 0, 0, Math.PI * 2);
    ctx.moveTo(8.8, 0);
    ctx.arc(7, 0, 1.8, 0, Math.PI * 2);
    // Křídla: úzká, dozadu zahnutá do špičky.
    for (var s = -1; s <= 1; s += 2) {
      ctx.moveTo(3, s * 1);
      ctx.quadraticCurveTo(0.5, s * 12 * kridla, -11, s * 20 * kridla);
      ctx.quadraticCurveTo(-4, s * 8 * kridla, -3, s * 1);
    }
    // Hluboce vykrojený ocas — podle něj se vlaštovka pozná.
    ctx.moveTo(-6, -1.2);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-10.5, 0);
    ctx.lineTo(-18, 5);
    ctx.lineTo(-6, 1.2);
    ctx.fill();
    ctx.restore();
  }

  function hejno() {
    var zleva = Math.random() < 0.5;
    var pocet = 1 + Math.floor(Math.random() * 3);
    var louka = horniHranaLouky();
    var zaklad = Math.max(16, Math.min(32, sirka / 45));
    var vyskaLetu = nahoda(vyska * 0.12, louka * 0.7);
    var rychlost = nahoda(260, 380) * Math.max(0.6, Math.min(1, sirka / 1200));
    var strmhlav = Math.random() < 0.45;

    for (var i = 0; i < pocet; i++) {
      var hloubka = i === 0 ? 1 : nahoda(0.65, 1);  // vzdálenější jsou menší a světlejší
      ptaci.push({
        zleva: zleva,
        zpozdeni: i * nahoda(0.15, 0.45),
        t: 0,
        doba: (sirka + 120) / rychlost * nahoda(0.95, 1.1),
        y0: vyskaLetu + nahoda(-30, 30) * i,
        vlna: nahoda(15, 40),
        faze: nahoda(0, 6.28),
        // Střemhlavý let: kdy (0–1 přeletu) a jak hluboko k louce.
        strmhlav: strmhlav ? { kdy: nahoda(0.3, 0.7), hloubka: Math.max(0, louka - 15 - vyskaLetu) } : null,
        rozpeti: zaklad * hloubka * nahoda(0.9, 1.1),
        pruhlednost: 0.55 + 0.4 * hloubka,
        mavani: nahoda(8, 11)
      });
    }
  }

  function poloha(p, t) {
    var u = t / p.doba;
    var x = p.zleva ? -60 + u * (sirka + 120) : sirka + 60 - u * (sirka + 120);
    var y = p.y0 + Math.sin(u * 6.28 * 1.3 + p.faze) * p.vlna;
    if (p.strmhlav) {
      var d = (u - p.strmhlav.kdy) / 0.12;
      y += p.strmhlav.hloubka * Math.exp(-d * d);
    }
    return { x: x, y: y };
  }

  function snimek(ted) {
    if (!bezi) return;
    var dt = Math.min((ted - naposled) / 1000, 0.05);
    naposled = ted;

    ctx.clearRect(0, 0, sirka, vyska);
    for (var i = ptaci.length - 1; i >= 0; i--) {
      var p = ptaci[i];
      p.t += dt;
      var t = p.t - p.zpozdeni;
      if (t < 0) continue;
      if (t > p.doba) { ptaci.splice(i, 1); continue; }

      var a = poloha(p, t), b = poloha(p, t + 0.02);
      var uhel = Math.atan2(b.y - a.y, b.x - a.x);
      // Série mávnutí a klouzání; ve střemhlavém letu křídla přitažená.
      var cyklus = (t * 0.9 + p.faze) % 1.6;
      var kridla = cyklus < 0.7 ? 0.55 + 0.45 * Math.cos(t * p.mavani * 6.28) : 1;
      if (b.y - a.y > 3) kridla = Math.min(kridla, 0.6);
      nakreslit(a.x, a.y, uhel, p.rozpeti, kridla, p.pruhlednost);
    }

    if (!ptaci.length) {
      bezi = false;
      naplanovat();
      return;
    }
    requestAnimationFrame(snimek);
  }

  function vyletet() {
    casovac = null;
    if (!viditelny || koren.hasAttribute('data-noc') || document.hidden) {
      naplanovat();
      return;
    }
    if (!platno) {
      platno = document.createElement('canvas');
      platno.className = 'vlastovky';
      platno.setAttribute('aria-hidden', 'true');
      hero.appendChild(platno);
      ctx = platno.getContext('2d');
      zmerit();
    }
    hejno();
    if (!bezi) {
      bezi = true;
      naposled = performance.now();
      requestAnimationFrame(snimek);
    }
  }

  function naplanovat(za) {
    if (casovac) return;
    casovac = setTimeout(vyletet, (za != null ? za : nahoda(PAUZA_OD, PAUZA_DO)) * 1000);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (zaznamy) {
      viditelny = zaznamy[0].isIntersecting;
    }).observe(hero);
  }

  var zmenaCeka;
  window.addEventListener('resize', function () {
    if (!platno) return;
    clearTimeout(zmenaCeka);
    zmenaCeka = setTimeout(zmerit, 200);
  }, { passive: true });

  // První hejno brzy po načtení, ať je vidět, že tu jsou.
  naplanovat(nahoda(1.5, 3));
})();
