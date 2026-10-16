/* ==========================================================================
   Vlaštovky přes denní oblohu, netopýři v noci

   Občas přes hero přeletí hejnko 1–3 vlaštovek: pár rychlých mávnutí,
   klouzání, sem tam střemhlav dolů k louce (lovení hmyzu nad trávou je
   pro ně typické). Mezi přelety se nic nekreslí a smyčka spí — trvalý
   pohyb by na denní obloze, která je na obrazovce pořád, zbytečně
   žral baterku.

   Den = bez data-noc na <html> (nastavuje assets/obloha.js). V noci
   místo vlaštovek přiletí 1–3 netopýři, chvíli kličkují nad loukou a loví
   světlušky (assets/svetlusky.js, window.SVETLUSKY) — sežraná světluška
   zhasne a za pár vteřin se objeví jinde. Netopýři jsou skoro černí, na
   noční obloze je schválně skoro nevidět. Pod prefers-reduced-motion nic.

   Klik (ťuknutí) na vlaštovku ji omráčí: spadne mezi kytky, nad hlavou
   jí krouží hvězdičky. Přikrade se kočka, chvíli vrtí zadkem, skočí —
   a vlaštovka těsně před ní vystřelí pryč. S netopýrem je to stejné. Kočka zůstane sedět, otráveně
   se rozhlédne, olízne si tlapku a odejde. Ostatní z hejnka poblíž se
   vyplaší (obrátí směr, zrychlí, vystoupají). Během scénky klik jen plaší.
   Spadlá vlaštovka a kočka se kreslí na druhé plátno, které je v DOM
   před loukou — proto jsou za kytkami. Louka se kolem kočky rozhrne
   (window.LOUKA z assets/vitr.js).
   Plátno má pointer-events: none (nesmí překážet textu), proto se klik
   poslouchá na celém hero a ptáci se hledají podle souřadnic.
   ========================================================================== */

(function () {
  'use strict';

  if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var hero = document.querySelector('.hero');
  if (!hero) return;

  var PAUZA_OD = 6, PAUZA_DO = 16;   // s mezi přelety
  var BARVA = '#16213F';             // tmavě modročerná, jako hřbet vlaštovky
  var KOCKA = '#2A2431', OKO = '#E9CF3A', HVEZDA = '#F6D93B';
  var NETOPYR = '#07060A';
  var ZEM = 0.72;                    // kde v louce (0 = horní hrana, 1 = dno) leží vlaštovka a chodí kočka

  var koren = document.documentElement;
  var platno = null, ctx = null;
  var zem = null, zctx = null;       // plátno za loukou
  var scenka = null;
  var sirka = 0, vyska = 0;
  var ptaci = [];                    // vlaštovky i netopýři (p.netopyr)
  var zablesky = [];                 // kde netopýr právě sežral světlušku
  var bezi = false, viditelny = true, casovac = null;
  var naposled = 0;

  function nahoda(a, b) { return a + Math.random() * (b - a); }

  function zmerit() {
    var r = hero.getBoundingClientRect();
    sirka = r.width;
    vyska = r.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    [platno, zem].forEach(function (p) {
      p.width = Math.round(sirka * dpr);
      p.height = Math.round(vyska * dpr);
      p.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  function horniHranaLouky() {
    var louka = hero.querySelector('.louka');
    var h = hero.getBoundingClientRect();
    return louka ? louka.getBoundingClientRect().top - h.top : vyska * 0.8;
  }

  /* Silueta zespodu, letí ve směru +x, rozpětí 40 jednotek.
     `kridla` 1 = roztažená, menší = křídla ve švihu. */
  function nakreslit(c, x, y, uhel, rozpeti, kridla, pruhlednost) {
    var m = rozpeti / 40;
    c.save();
    c.translate(x, y);
    c.rotate(uhel);
    c.scale(m, m);
    c.globalAlpha = pruhlednost;
    c.fillStyle = BARVA;
    c.beginPath();
    c.ellipse(0, 0, 7, 2.3, 0, 0, Math.PI * 2);
    c.moveTo(8.8, 0);
    c.arc(7, 0, 1.8, 0, Math.PI * 2);
    // Křídla: úzká, dozadu zahnutá do špičky.
    for (var s = -1; s <= 1; s += 2) {
      c.moveTo(3, s * 1);
      c.quadraticCurveTo(0.5, s * 12 * kridla, -11, s * 20 * kridla);
      c.quadraticCurveTo(-4, s * 8 * kridla, -3, s * 1);
    }
    // Hluboce vykrojený ocas — podle něj se vlaštovka pozná.
    c.moveTo(-6, -1.2);
    c.lineTo(-18, -5);
    c.lineTo(-10.5, 0);
    c.lineTo(-18, 5);
    c.lineTo(-6, 1.2);
    c.fill();
    c.restore();
  }

  /* Netopýr zepředu, hlavou nahoru (−y), rozpětí 40 jednotek. `mav` −1…1:
     1 = křídla nahoře, −1 = dole. `slozena` 0–1 přitáhne křídla k tělu. */
  function nakreslitNetopyra(c, x, y, uhel, rozpeti, mav, slozena) {
    var m = rozpeti / 40, w = 1 - 0.6 * (slozena || 0);
    c.save();
    c.translate(x, y);
    c.rotate(uhel);
    c.scale(m, m);
    c.fillStyle = NETOPYR;
    c.beginPath();
    c.ellipse(0, 1, 3, 5.5, 0, 0, Math.PI * 2);
    c.moveTo(2.6, -5);
    c.arc(0, -5, 2.6, 0, Math.PI * 2);
    c.moveTo(-2.5, -6); c.lineTo(-2.3, -10.5); c.lineTo(-0.5, -7);   // uši
    c.moveTo(2.5, -6); c.lineTo(2.3, -10.5); c.lineTo(0.5, -7);
    c.fill();
    // Křídla: náběžná hrana obloukem ke špičce, zadní vykrojená mezi prsty.
    for (var s = -1; s <= 1; s += 2) {
      var ty = -9 * mav;
      c.beginPath();
      c.moveTo(s * 2, -2);
      c.quadraticCurveTo(s * 10 * w, -4 - 9 * mav, s * 20 * w, ty - 1);
      c.quadraticCurveTo(s * 16 * w, ty * 0.6 + 1, s * 14 * w, ty * 0.55 + 6);
      c.quadraticCurveTo(s * 10 * w, ty * 0.3 + 2, s * 8 * w, ty * 0.3 + 7);
      c.quadraticCurveTo(s * 5 * w, ty * 0.1 + 3, s * 2, 5);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function naklon(vx) { return Math.max(-0.5, Math.min(0.5, vx / 600)); }

  function netopyri() {
    var pocet = 1 + Math.floor(Math.random() * 3);
    var zaklad = Math.max(14, Math.min(26, sirka / 55));
    var louka = horniHranaLouky();
    for (var i = 0; i < pocet; i++) {
      var zleva = Math.random() < 0.5;
      ptaci.push({
        netopyr: true,
        t: 0,
        zpozdeni: i * nahoda(0.5, 2.5),
        x: zleva ? -40 : sirka + 40,
        y: nahoda(vyska * 0.1, louka * 0.8),
        vx: (zleva ? 1 : -1) * 120, vy: 0,
        zbyva: nahoda(12, 25),          // s, jak dlouho loví, než odletí
        cil: null, cilDo: 0, korist: null, domu: null,
        rychlost: nahoda(150, 210) * Math.max(0.7, Math.min(1, sirka / 1200)),
        rozpeti: zaklad * nahoda(0.85, 1.15),
        pruhlednost: 1,
        mavani: nahoda(6, 8)
      });
    }
  }

  /* Netopýr neletí po dráze jako vlaštovka: kličkuje mezi náhodnými body
     nad loukou (nový každou chvíli, z toho ten trhaný let) a občas si
     vyhlédne světlušku, zrychlí a sežere ji. Když mu vyprší čas nebo
     začne den, odletí za bližší okraj. Vrací false, když je pryč. */
  function letNetopyra(p, dt) {
    var t = p.t - p.zpozdeni;
    if (t < 0) return true;
    p.zbyva -= dt;
    var sv = window.SVETLUSKY;
    if (p.korist && (p.korist.snezena || t > p.cilDo)) p.korist = null;   // nechytil, vzdá to
    if (!p.domu && (p.zbyva <= 0 || !koren.hasAttribute('data-noc'))) {
      p.domu = { x: p.x < sirka / 2 ? -80 : sirka + 80, y: nahoda(0, vyska * 0.3) };
      p.korist = null;
    }
    if (p.domu) p.cil = p.domu;
    else if (p.korist) p.cil = p.korist;
    else if (!p.cil || t > p.cilDo) {
      var seznam = sv ? sv.seznam() : [];
      if (seznam.length && Math.random() < 0.35) {
        p.korist = p.cil = seznam[Math.floor(Math.random() * seznam.length)];
        p.cilDo = t + 4;
      } else {
        p.cil = { x: nahoda(sirka * 0.05, sirka * 0.95), y: nahoda(vyska * 0.08, horniHranaLouky() + 10) };
        p.cilDo = t + nahoda(0.4, 1.1);
      }
    }

    var dx = p.cil.x - p.x, dy = p.cil.y - p.y, d = Math.hypot(dx, dy) || 1;
    var v = p.rychlost * (p.korist ? 1.4 : 1);
    var k = Math.min(1, dt * (p.korist ? 5 : 3));
    p.vx += (dx / d * v - p.vx) * k + nahoda(-1, 1) * 900 * dt;
    p.vy += (dy / d * v - p.vy) * k + nahoda(-1, 1) * 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.korist && d < Math.max(8, p.rozpeti * 0.35)) {
      sv.sezrat(p.korist);
      zablesky.push({ x: p.korist.x, y: p.korist.y, t: 0 });
      p.korist = p.cil = null;
      p.vy -= 120;                                   // a hned zas nahoru
    } else if (!p.korist && !p.domu && d < 20) {
      p.cilDo = 0;
    }
    if (p.domu && (p.x < -60 || p.x > sirka + 60)) return false;

    nakreslitNetopyra(ctx, p.x, p.y, naklon(p.vx), p.rozpeti, Math.sin(t * p.mavani * 6.28), 0);
    return true;
  }

  // Sežraná světluška naposled krátce blikne.
  function kreslitZablesky(dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = zablesky.length - 1; i >= 0; i--) {
      var z = zablesky[i];
      z.t += dt;
      if (z.t > 0.3) { zablesky.splice(i, 1); continue; }
      ctx.globalAlpha = 0.7 * (1 - z.t / 0.3);
      ctx.fillStyle = '#E6FA82';
      ctx.beginPath();
      ctx.arc(z.x, z.y, 3 + 10 * z.t / 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
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
    zctx.clearRect(0, 0, sirka, vyska);
    if (scenka && !scena(scenka, dt)) {
      scenka = null;
      if (window.LOUKA) window.LOUKA.prekazka(null);
    }
    for (var i = ptaci.length - 1; i >= 0; i--) {
      var p = ptaci[i];
      p.t += dt;
      if (p.utek) {
        if (!uletet(p, dt)) ptaci.splice(i, 1);
        continue;
      }
      if (p.netopyr) {
        if (!letNetopyra(p, dt)) ptaci.splice(i, 1);
        continue;
      }
      var t = p.t - p.zpozdeni;
      if (t < 0) continue;
      if (t > p.doba) { ptaci.splice(i, 1); continue; }

      var a = poloha(p, t), b = poloha(p, t + 0.02);
      var uhel = Math.atan2(b.y - a.y, b.x - a.x);
      // Série mávnutí a klouzání; ve střemhlavém letu křídla přitažená.
      var cyklus = (t * 0.9 + p.faze) % 1.6;
      var kridla = cyklus < 0.7 ? 0.55 + 0.45 * Math.cos(t * p.mavani * 6.28) : 1;
      if (b.y - a.y > 3) kridla = Math.min(kridla, 0.6);
      nakreslit(ctx, a.x, a.y, uhel, p.rozpeti, kridla, p.pruhlednost);
      p.x = a.x; p.y = a.y; p.vx = (b.x - a.x) / 0.02; p.vy = (b.y - a.y) / 0.02;   // pro vyplašení
    }

    kreslitZablesky(dt);

    if (!ptaci.length && !scenka && !zablesky.length) {
      bezi = false;
      naplanovat();
      return;
    }
    requestAnimationFrame(snimek);
  }

  /* ---------- Vyplašení ----------
     Vyplašená vlaštovka opustí naplánovanou dráhu a letí volně: otočí
     se proti původnímu směru, stoupá a zrychluje, mává rychleji. Vrací
     false, když už je mimo obrazovku. */
  function vyplasit(p) {
    var rychlost = Math.max(300, Math.hypot(p.vx, p.vy)) * nahoda(1.25, 1.5);
    var smer = p.vx >= 0 ? -1 : 1;                 // obrátit vodorovný směr
    var uhel = nahoda(0.35, 0.8);                    // a stoupat
    p.utek = {
      x: p.x, y: p.y,
      vx: smer * Math.cos(uhel) * rychlost,
      vy: -Math.sin(uhel) * rychlost,
      t: 0
    };
  }

  function uletet(p, dt) {
    var u = p.utek;
    u.t += dt;
    u.vx *= 1 + 0.6 * dt;                            // nabírá rychlost
    u.vy -= 40 * dt;                                 // a výšku
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (p.netopyr) {
      nakreslitNetopyra(ctx, u.x, u.y, naklon(u.vx), p.rozpeti, Math.sin(u.t * p.mavani * 1.6 * 6.28), 0);
    } else {
      var kridla = 0.5 + 0.5 * Math.cos(u.t * p.mavani * 1.7 * 6.28);
      nakreslit(ctx, u.x, u.y, Math.atan2(u.vy, u.vx), p.rozpeti, kridla, p.pruhlednost);
    }
    return u.x > -80 && u.x < sirka + 80 && u.y > -80;
  }

  /* ---------- Omráčená vlaštovka a kočka ----------
     Fáze: pad → lezi → plizi (kočka se plíží, posledních pár kroků
     přikrčená) → vrti (vrtí zadkem) → skok (v první čtvrtině vlaštovka
     uletí) → sedi (kouká za ní, pak se rozhlédne) → olizuje → odchazi.
     Kočka je kreslená zboku ve směru +x, počátek na zemi pod tělem. */
  function omracit(p) {
    var louka = horniHranaLouky();
    // Velikost podle výšky louky — kočka je zhruba poloviční co kytky.
    var m = Math.max(0.6, Math.min(2, (vyska - louka) / 120));
    scenka = {
      faze: 'pad', t: 0, cas: 0, m: m, p: p,
      y0: p.y, r: Math.max(p.rozpeti, 24 * m),        // dole je blíž, tak větší
      x: p.x, y: p.y, vx: (p.vx || 0) * 0.15, vy: -90, uhel: Math.atan2(p.vy || 0, p.vx || 1),
      odraz: false, uletela: false,
      zemY: louka + (vyska - louka) * ZEM,
      kocka: null
    };
  }

  function prechod(s, faze) { s.faze = faze; s.t = 0; }

  // Vrací false, když kočka odešla a scénka skončila.
  function scena(s, dt) {
    s.t += dt;
    s.cas += dt;
    var p = s.p, k = s.kocka, m = s.m;

    if (s.faze === 'pad') {
      s.vy += 1100 * dt;
      s.x = Math.max(90 * m, Math.min(sirka - 90 * m, s.x + s.vx * dt));
      s.y += s.vy * dt;
      s.uhel += 9 * dt;                               // kotrmelce
      if (s.y >= s.zemY) {
        s.y = s.zemY;
        if (!s.odraz && s.vy > 250) { s.vy *= -0.25; s.odraz = true; }
        else {
          // Hlavou ke středu, odkud přijde kočka z bližšího kraje, je hlava vidět.
          s.lezi = s.x < sirka / 2 ? Math.PI - 0.3 : 0.3;
          prechod(s, 'lezi');
        }
      }
    }
    if (s.faze === 'lezi' && s.t > 0.7) {
      var zleva = s.x < sirka / 2;
      s.kocka = k = { x: zleva ? -50 * m : sirka + 50 * m, smer: zleva ? 1 : -1, krok: 0, prikrceni: 0, vyskok: 0 };
      prechod(s, 'plizi');
    }
    if (s.faze === 'plizi') {
      var zbyva = (s.x - k.smer * 52 * m - k.x) * k.smer;
      var plizeni = zbyva < 95 * m;
      k.prikrceni = Math.max(0, Math.min(1, k.prikrceni + (plizeni ? 3 : -3) * dt));
      var krok = Math.min(zbyva, (plizeni ? 45 : 150) * m * dt);
      k.x += k.smer * krok;
      k.krok += krok / (m * 5);
      if (zbyva <= 0.5) prechod(s, 'vrti');
    }
    if (s.faze === 'vrti' && s.t > 0.85) {
      k.x0 = k.x;
      prechod(s, 'skok');
    }
    if (s.faze === 'skok') {
      var u = Math.min(1, s.t / 0.45);
      k.x = k.x0 + k.smer * 46 * m * u;
      k.vyskok = Math.sin(Math.PI * u) * 26 * m;
      if (u > 0.22 && !s.uletela) {
        // Vystřelí pryč šikmo vzhůru, kočce nad hlavou.
        s.uletela = true;
        p.utek = { x: s.x, y: s.y - 4, vx: k.smer * nahoda(190, 260), vy: -nahoda(520, 620), t: 0 };
        p.rozpeti = s.r;
        ptaci.push(p);
      }
      if (u >= 1) { k.vyskok = 0; prechod(s, 'sedi'); }
    }
    if (s.faze === 'sedi' && s.t > 1.6) prechod(s, 'olizuje');
    if (s.faze === 'olizuje' && s.t > 1.9) { k.smer = -k.smer; k.prikrceni = 0; prechod(s, 'odchazi'); }
    if (s.faze === 'odchazi') {
      var kr = 110 * m * dt;
      k.x += k.smer * kr;
      k.krok += kr / (m * 5);
      if (k.x < -60 * m || k.x > sirka + 60 * m) return false;
    }

    // --- kreslení ---
    var mb = s.r / 40;
    if (!s.uletela) {
      if (s.faze === 'pad') {
        var dole = Math.max(0, Math.min(1, (s.y - s.y0) / (s.zemY - s.y0 || 1)));
        var r = p.rozpeti + (s.r - p.rozpeti) * dole;
        if (p.netopyr) nakreslitNetopyra(zctx, s.x, s.y, s.uhel, r, Math.sin(s.cas * 40), 0.3);
        else nakreslit(zctx, s.x, s.y, s.uhel, r, 0.6 + 0.4 * Math.sin(s.cas * 30), p.pruhlednost);
      } else {
        // Leží, občas sebou cukne; když kočka vrtí zadkem, probírá se.
        var cuk = s.faze === 'vrti' ? 0.12 * Math.sin(s.cas * 20) : 0.04 * Math.sin(s.cas * 2.5);
        var y = s.y - 2 * mb;
        // Netopýr má hlavu na −y, vlaštovka na +x — proto ta čtvrtotáčka.
        if (p.netopyr) nakreslitNetopyra(zctx, s.x, y, s.lezi + Math.PI / 2 + cuk, s.r, 0.2 + cuk * 3, 0.7);
        else nakreslit(zctx, s.x, y, s.lezi + cuk, s.r, 0.8 + cuk, p.pruhlednost);
        // Hvězdičky nad hlavou — na horním plátně, ať je kytky nezakryjí.
        hvezdicky(ctx, s.x + Math.cos(s.lezi) * 7 * mb, y + Math.sin(s.lezi) * 7 * mb - 12 * mb,
          s.cas, mb * 1.3);
      }
    }
    if (k) {
      if (window.LOUKA) window.LOUKA.prekazka(hero.getBoundingClientRect().left + k.x);
      var poza = { cas: s.cas, krok: k.krok, prikrceni: k.prikrceni, vrteni: 0, skok: 0, hlava: 0, tlapka: 0, sed: false };
      var smer = k.smer;
      if (s.faze === 'vrti') poza.vrteni = Math.sin(s.t * 26) * 2.5;
      if (s.faze === 'skok') { poza.skok = s.t / 0.45; poza.prikrceni = 0.3; }
      if (s.faze === 'sedi' || s.faze === 'olizuje') {
        poza.sed = true;
        if (s.faze === 'sedi') {
          if (s.t < 0.75) poza.hlava = -0.65;                         // kouká, kam uletěla
          else if (s.t < 1.2) { poza.hlava = -0.1; smer = -smer; }    // otráveně se rozhlédne
          else poza.hlava = 0.1;
        } else {
          poza.tlapka = Math.min(1, s.t * 4, (1.9 - s.t) * 4);
          poza.hlava = 0.3 + 0.08 * Math.sin(s.t * 11) * poza.tlapka;
        }
      }
      kreslitKocku(zctx, k.x, s.zemY - k.vyskok, smer, m, poza);
    }
    return true;
  }

  function hvezdicky(c, x, y, cas, m) {
    c.save();
    c.fillStyle = HVEZDA;
    c.strokeStyle = BARVA;
    c.lineWidth = 0.8;
    for (var i = 0; i < 3; i++) {
      var a = cas * 4 + i * 2.094;
      var hx = x + Math.cos(a) * 14 * m, hy = y + Math.sin(a) * 4.5 * m;
      var r = 4.5 * m * (0.85 + 0.15 * Math.sin(a));
      c.globalAlpha = Math.sin(a) > 0 ? 1 : 0.6;          // vzadu za hlavou bledší
      c.beginPath();
      for (var j = 0; j < 10; j++) {
        var b = cas * 3 + j * Math.PI / 5;
        var d = j % 2 ? r * 0.45 : r;
        if (j) c.lineTo(hx + Math.cos(b) * d, hy + Math.sin(b) * d);
        else c.moveTo(hx + Math.cos(b) * d, hy + Math.sin(b) * d);
      }
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  function kreslitKocku(c, x, y, smer, m, o) {
    c.save();
    c.translate(x, y);
    c.scale(smer * m, m);
    c.fillStyle = c.strokeStyle = KOCKA;
    c.lineCap = c.lineJoin = 'round';
    if (o.sed) kockaSedi(c, o); else kockaStoji(c, o);
    c.restore();
  }

  function kockaStoji(c, o) {
    var k = o.prikrceni, v = o.vrteni;
    var telo = -17 + 7 * k;
    if (o.skok) {
      // Ve skoku se natáhne: nejdřív čumákem nahoru, pak dolů.
      c.translate(0, telo);
      c.rotate(-0.35 * (1 - 2 * o.skok));
      c.translate(0, -telo);
    }
    c.lineWidth = 4;
    [[11, 0], [13, Math.PI], [-12, Math.PI], [-10, 0]].forEach(function (n) {
      var zadni = n[0] < 0;
      var f = o.krok + n[1];
      var dx = o.skok ? (zadni ? -9 : 9) : Math.sin(f) * 5 * (1 - 0.5 * k);
      var zdvih = o.skok ? 0 : Math.max(0, Math.cos(f)) * 3 * (1 - 0.6 * k);
      c.beginPath();
      c.moveTo(n[0] + (zadni ? v : 0), telo + 3);
      c.lineTo(n[0] + dx + (zadni ? v * 0.5 : 0), -zdvih);
      c.stroke();
    });
    c.beginPath();
    c.ellipse(v * 0.5, telo, 19, 7.5 - k, v * 0.02, 0, Math.PI * 2);
    c.fill();
    // Ocas: vztyčený, při plížení nízko a cuká špičkou.
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(-17 + v, telo - 2);
    c.quadraticCurveTo(-30 + v, telo - 3 + 2 * k,
      -27 - 12 * k + v + Math.sin(o.cas * 3) * 3 * (1 - k),
      telo - 22 * (1 - k) - 2 * k + Math.sin(o.cas * 14) * 3 * k);
    c.stroke();
    hlava(c, 21 + 3 * k, telo - 7 + 6 * k, o.hlava, false);
  }

  function kockaSedi(c, o) {
    // Ocas leží na zemi a otráveně šlehá špičkou.
    var sleh = Math.sin(o.cas * 5);
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(-10, -3);
    c.quadraticCurveTo(-24, 0, -21 + sleh * 4, -5 - Math.abs(sleh) * 4);
    c.stroke();
    c.beginPath();
    c.ellipse(-5, -8, 10, 8, 0, 0, Math.PI * 2);
    c.ellipse(1, -18, 8.5, 13, 0.28, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3.6;
    var t = o.tlapka;                                   // druhá tlapka k puse
    c.beginPath();
    c.moveTo(3, -14);
    c.lineTo(3, 0);
    c.moveTo(6, -16);
    c.lineTo(7 + 6 * t, -24 * t);
    c.stroke();
    hlava(c, 8, -31 + 2 * t, o.hlava, t > 0.5);
  }

  function hlava(c, x, y, uhel, zavrene) {
    c.save();
    c.translate(x, y);
    c.rotate(uhel);
    c.beginPath();
    c.ellipse(0, 0, 7.5, 6.5, 0, 0, Math.PI * 2);
    c.ellipse(5.5, 1.8, 3.6, 2.8, 0, 0, Math.PI * 2);   // čumák
    c.moveTo(-5.5, -2.5); c.lineTo(-4.5, -11.5); c.lineTo(0, -5);   // uši
    c.moveTo(0.5, -5.5); c.lineTo(4.5, -11.5); c.lineTo(6.5, -2);
    c.fill();
    c.fillStyle = OKO;
    c.beginPath();
    if (zavrene) c.ellipse(3, -1.2, 1.5, 0.45, 0, 0, Math.PI * 2);
    else c.arc(3, -1.5, 1.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Klik/ťuknutí: trefená vlaštovka (netopýr) spadne (nebo se jen vyplaší, když
  // už jedna scénka běží), ty z hejna poblíž se vyplaší.
  hero.addEventListener('pointerdown', function (e) {
    if (!bezi || !ptaci.length) return;
    var r = hero.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var zasah = null;
    ptaci.forEach(function (p) {
      if (p.utek || p.x == null) return;
      var dosah = Math.max(40, p.rozpeti * 1.3);  // je malá a rychlá — ať se trefí i prstem
      if (Math.hypot(p.x - x, p.y - y) < dosah) zasah = p;
    });
    if (!zasah) return;
    ptaci.forEach(function (p) {
      if (p.utek || p.x == null) return;
      if (p === zasah ? scenka : Math.hypot(p.x - zasah.x, p.y - zasah.y) < 160) vyplasit(p);
    });
    if (!scenka) {
      ptaci.splice(ptaci.indexOf(zasah), 1);
      omracit(zasah);
    }
  });

  function vyletet() {
    casovac = null;
    if (!viditelny || document.hidden) {
      naplanovat();
      return;
    }
    if (!platno) {
      platno = document.createElement('canvas');
      platno.className = 'vlastovky';
      platno.setAttribute('aria-hidden', 'true');
      hero.appendChild(platno);
      ctx = platno.getContext('2d');
      zem = document.createElement('canvas');
      zem.className = 'vlastovky';
      zem.setAttribute('aria-hidden', 'true');
      hero.insertBefore(zem, hero.querySelector('.louka'));
      zctx = zem.getContext('2d');
      zmerit();
    }
    if (koren.hasAttribute('data-noc')) netopyri(); else hejno();
    if (!bezi) {
      bezi = true;
      naposled = performance.now();
      requestAnimationFrame(snimek);
    }
  }

  function naplanovat(za) {
    if (casovac) return;
    // Netopýři se vracejí dřív — v noci mají být skoro pořád.
    if (za == null) za = koren.hasAttribute('data-noc') ? nahoda(2, 6) : nahoda(PAUZA_OD, PAUZA_DO);
    casovac = setTimeout(vyletet, za * 1000);
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

  // První hejno (netopýři) brzy po načtení, ať je vidět, že tu jsou.
  naplanovat(nahoda(1.5, 3));
})();
