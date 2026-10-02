/* ==========================================================================
   Světlušky nad loukou a padající hvězdy — od soumraku do svítání

   Kdy je noc, rozhoduje assets/obloha.js atributem data-noc na <html>
   (podle času návštěvníka, ?cas= i ladicího panelu). Tenhle soubor ho
   jen sleduje.

   Každá světluška letí ke květu (horní okraj rostliny v živém SVG louky),
   chvíli na něm posedí a přeletí na některou z blízkých. Bliká vlastním
   rytmem. Když živé SVG není (vitr.js selhal), míří na náhodná místa
   v horní části louky.

   Je to jediný trvalý pohyb na stránce — proto jen v noci, jen když je
   hero na obrazovce, a pod prefers-reduced-motion vůbec.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = document.querySelector('.hero');
  if (!hero) return;

  var koren = document.documentElement;
  var platno = null, ctx = null, sprite = null;
  var sirka = 0, vyska = 0;
  var svetlusky = [];
  var bezi = false, viditelny = true;
  var naposled = 0, cas = 0;
  var jas = 0;            // celkové roztmívání při příchodu/odchodu noci
  var cile = [], cileKdy = -1;

  function nahoda(a, b) { return a + Math.random() * (b - a); }

  /* Záře je předkreslená do malého plátna; drawImage je pak levnější než
     radialGradient pro každou světlušku v každém snímku. */
  function pripravitSprite() {
    var r = 16;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = r * 2;
    var s = sprite.getContext('2d');
    var g = s.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(250,255,200,1)');
    g.addColorStop(0.12, 'rgba(230,250,130,0.95)');
    g.addColorStop(0.35, 'rgba(200,240,90,0.35)');
    g.addColorStop(1, 'rgba(180,230,70,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, r * 2, r * 2);
  }

  function zmerit() {
    var r = hero.getBoundingClientRect();
    sirka = r.width;
    vyska = r.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    platno.width = Math.round(sirka * dpr);
    platno.height = Math.round(vyska * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cileKdy = -1;
  }

  // Místa, kam se dá sednout. Přepočítávají se jen jednou za pár vteřin —
  // rostliny se ve větru jen nakloní, nikam neutečou.
  function aktualniCile() {
    if (cileKdy >= 0 && cas - cileKdy < 3) return cile;
    cileKdy = cas;
    cile = [];
    var h = hero.getBoundingClientRect();
    var svg = hero.querySelector('svg.louka-ziva');

    if (svg) {
      Array.prototype.forEach.call(svg.querySelectorAll('.kytka'), function (k) {
        var b = k.getBoundingClientRect();
        var x = b.left + b.width / 2 - h.left;
        if (b.height < 8 || x < 12 || x > sirka - 12) return;
        cile.push({ x: x, y: b.top - h.top + Math.min(b.height * 0.06, 10), w: b.width });
      });
    }

    if (!cile.length) {
      var louka = hero.querySelector('.louka');
      var top = louka ? louka.getBoundingClientRect().top - h.top : vyska * 0.75;
      var pas = vyska - top;
      for (var i = 0; i < 40; i++) {
        cile.push({ x: nahoda(12, sirka - 12), y: top + pas * nahoda(0.05, 0.45), w: 0 });
      }
    }
    return cile;
  }

  // Bod na květu — u širších rostlin ne vždycky přesně uprostřed.
  function bodNa(c) {
    return { x: c.x + (Math.random() - 0.5) * c.w * 0.5, y: c.y + nahoda(0, 6) };
  }

  // Další květ: ze tří náhodných kandidátů nejbližší, ať přeletuje
  // hlavně na sousední kytky a necestuje přes celou louku.
  function dalsiCil(s) {
    var seznam = aktualniCile();
    var nejlepsi = null, nejblize = Infinity;
    for (var i = 0; i < 3; i++) {
      var c = seznam[Math.floor(Math.random() * seznam.length)];
      var d = Math.hypot(c.x - s.x, c.y - s.y);
      if (d > 25 && d < nejblize) { nejblize = d; nejlepsi = c; }
    }
    return bodNa(nejlepsi || seznam[Math.floor(Math.random() * seznam.length)]);
  }

  function vytvorit() {
    var pocet = Math.max(6, Math.min(14, Math.round(sirka / 110)));
    var seznam = aktualniCile();
    svetlusky = [];
    for (var i = 0; i < pocet; i++) {
      var start = bodNa(seznam[Math.floor(Math.random() * seznam.length)]);
      svetlusky.push({
        x: start.x, y: start.y, vx: 0, vy: 0,
        cil: start,
        sedi: nahoda(0.5, 4),
        rychlost: nahoda(22, 38),
        faze: nahoda(0, 10),
        perioda: nahoda(1.8, 3.6)
      });
    }
  }

  function pohnout(s, dt) {
    if (s.sedi > 0) {
      s.sedi -= dt;
      // Na květu jen lehce přešlapuje.
      s.x = s.cil.x + Math.sin(cas * 2.1 + s.faze) * 1.5;
      s.y = s.cil.y + Math.cos(cas * 1.7 + s.faze) * 1.2;
      if (s.sedi <= 0) { s.cil = dalsiCil(s); s.vx = 0; s.vy = -12; }
      return;
    }

    var dx = s.cil.x - s.x, dy = s.cil.y - s.y;
    var d = Math.hypot(dx, dy) || 1;
    if (d < 4) {
      s.sedi = nahoda(1.5, 4.5);
      return;
    }

    // Míří ke květu, ale kličkuje — kolmá složka podle sinusu, která
    // u cíle slábne, ať se nemine.
    var v = s.rychlost * Math.min(1, d / 40) + 6;
    var kmit = Math.sin(cas * 1.9 + s.faze) * Math.min(1, d / 60) * 0.7;
    var chtenaX = (dx / d - dy / d * kmit) * v;
    var chtenaY = (dy / d + dx / d * kmit) * v;
    var k = Math.min(1, dt * 2.5);
    s.vx += (chtenaX - s.vx) * k;
    s.vy += (chtenaY - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  // Bliknutí: krátce se rozsvítí, pak skoro zhasne až do dalšího.
  function svit(s) {
    var u = ((cas + s.faze) % s.perioda) / s.perioda;
    return u < 0.35 ? 0.15 + 0.85 * Math.sin(u / 0.35 * Math.PI) : 0.15;
  }

  /* ---------- Padající hvězdy ----------
     Jedou ve stejné noční smyčce jako světlušky, ať nevzniká další
     animace. Občas krátká stopa šikmo dolů přes horní část oblohy. */

  var meteory = [];
  var dalsiMeteor = nahoda(2, 5);

  function novyMeteor() {
    var doprava = Math.random() < 0.5;
    var uhel = nahoda(15, 35) * Math.PI / 180;
    var rychlost = nahoda(800, 1200);
    meteory.push({
      x: nahoda(0.1, 0.9) * sirka,
      y: nahoda(70, Math.max(90, vyska * 0.4)),
      vx: Math.cos(uhel) * rychlost * (doprava ? 1 : -1),
      vy: Math.sin(uhel) * rychlost,
      t: 0,
      doba: nahoda(0.45, 0.8),
      delka: nahoda(90, 170)
    });
  }

  function meteoryKrok(dt, noc) {
    if (noc && cas >= dalsiMeteor) {
      novyMeteor();
      dalsiMeteor = cas + nahoda(3, 10);
    }
    ctx.lineCap = 'round';
    for (var i = meteory.length - 1; i >= 0; i--) {
      var m = meteory[i];
      m.t += dt;
      if (m.t > m.doba) { meteory.splice(i, 1); continue; }
      var hx = m.x + m.vx * m.t, hy = m.y + m.vy * m.t;
      var v = Math.hypot(m.vx, m.vy);
      // Ohon na začátku teprve narůstá, ať stopa nevyskočí celá najednou.
      var l = m.delka * Math.min(1, m.t / 0.15);
      var tx = hx - m.vx / v * l, ty = hy - m.vy / v * l;
      var a = Math.sin(Math.PI * m.t / m.doba) * jas;
      var g = ctx.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, 'rgba(240,246,255,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  function snimek(ted) {
    if (!bezi) return;
    var dt = Math.min((ted - naposled) / 1000, 0.05);
    naposled = ted;
    cas += dt;

    var noc = koren.hasAttribute('data-noc');
    jas = Math.max(0, Math.min(1, jas + (noc ? dt : -dt) / 2));

    ctx.clearRect(0, 0, sirka, vyska);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < svetlusky.length; i++) {
      var s = svetlusky[i];
      pohnout(s, dt);
      ctx.globalAlpha = svit(s) * jas;
      ctx.drawImage(sprite, s.x - 9, s.y - 9, 18, 18);
    }
    ctx.globalAlpha = 1;
    meteoryKrok(dt, noc);

    if (!noc && jas === 0) { zastavit(); return; }
    requestAnimationFrame(snimek);
  }

  function spustit() {
    if (bezi || !viditelny || !koren.hasAttribute('data-noc')) return;
    if (!platno) {
      platno = document.createElement('canvas');
      platno.className = 'svetlusky';
      platno.setAttribute('aria-hidden', 'true');
      hero.appendChild(platno);
      ctx = platno.getContext('2d');
      pripravitSprite();
      zmerit();
      vytvorit();
    }
    platno.hidden = false;
    bezi = true;
    naposled = performance.now();
    requestAnimationFrame(snimek);
  }

  function zastavit() {
    bezi = false;
    if (platno && jas === 0) platno.hidden = true;
  }

  new MutationObserver(spustit).observe(koren, { attributes: true, attributeFilter: ['data-noc'] });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (zaznamy) {
      viditelny = zaznamy[0].isIntersecting;
      if (viditelny) spustit();
      else bezi = false;
    }).observe(hero);
  }

  var zmenaCeka;
  window.addEventListener('resize', function () {
    if (!platno) return;
    clearTimeout(zmenaCeka);
    zmenaCeka = setTimeout(function () { zmerit(); vytvorit(); }, 200);
  }, { passive: true });

  spustit();
})();
