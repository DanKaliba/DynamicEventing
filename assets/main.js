/* ==========================================================================
   Svatební web — chování stránky
   Vanilla JS, žádné závislosti. Stránka funguje i bez něj (jen bez
   odpočtu, lightboxu a přepínače motivu).
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Přepínač světlého a tmavého motivu ---------- */

  var toggle = document.querySelector('.theme-toggle');

  if (toggle) {
    toggle.addEventListener('click', function () {
      var root = document.documentElement;
      var current = root.getAttribute('data-theme');

      // Není-li motiv vynucený, odvoď aktuální stav ze systémového nastavení.
      if (!current) {
        current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);

      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        // Soukromé okno nebo zablokovaná úložiště — motiv vydrží jen do reloadu.
      }
    });
  }

  /* ---------- Odpočet do svatby ---------- */

  var countdown = document.querySelector('.countdown');

  if (countdown) {
    var target = new Date(countdown.getAttribute('data-date')).getTime();

    var fields = {
      days: countdown.querySelector('[data-unit="days"]'),
      hours: countdown.querySelector('[data-unit="hours"]'),
      minutes: countdown.querySelector('[data-unit="minutes"]')
    };

    var tick = function () {
      var diff = target - Date.now();

      // Po svatbě odpočet nedává smysl — schovej ho.
      if (isNaN(target) || diff <= 0) {
        countdown.hidden = true;
        return false;
      }

      var minutes = Math.floor(diff / 60000);
      fields.days.textContent = Math.floor(minutes / 1440);
      fields.hours.textContent = Math.floor(minutes / 60) % 24;
      fields.minutes.textContent = minutes % 60;
      return true;
    };

    if (tick()) {
      setInterval(tick, 30000);
    }
  }

  /* ---------- Zvýraznění aktivní sekce v navigaci ---------- */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));

  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkFor = {};
    var sections = [];

    navLinks.forEach(function (link) {
      var section = document.querySelector(link.getAttribute('href'));
      if (section) {
        linkFor[section.id] = link;
        sections.push(section);
      }
    });

    var visible = {};

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });

      // Aktivní je první sekce shora, která je zrovna vidět.
      var active = null;
      for (var i = 0; i < sections.length; i++) {
        if (visible[sections[i].id]) {
          active = sections[i].id;
          break;
        }
      }

      navLinks.forEach(function (link) {
        link.removeAttribute('aria-current');
      });

      if (active && linkFor[active]) {
        linkFor[active].setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-72px 0px -55% 0px' });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ---------- Galerie a lightbox ---------- */

  var photos = window.GALLERY || [];
  var grid = document.getElementById('gallery');
  var empty = document.getElementById('gallery-empty');

  if (!grid) return;

  if (!photos.length) {
    // Žádné fotky zatím — mřížka pryč, hláška zůstane.
    grid.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;

  photos.forEach(function (photo, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Zvětšit fotku: ' + photo.alt);

    var img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.alt;
    img.loading = 'lazy';
    img.decoding = 'async';

    button.appendChild(img);
    button.addEventListener('click', function () {
      open(index);
    });

    grid.appendChild(button);
  });

  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCount = document.getElementById('lb-count');
  var current = 0;
  var lastFocused = null;

  function show(index) {
    // Modulo se zápornou hodnotou: zalomí se i doleva z první fotky.
    current = (index + photos.length) % photos.length;
    lbImg.src = photos[current].src;
    lbImg.alt = photos[current].alt;
    lbCount.textContent = (current + 1) + ' / ' + photos.length;
  }

  function open(index) {
    lastFocused = document.activeElement;
    show(index);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.lb-close').focus();
  }

  function close() {
    lightbox.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  lightbox.querySelector('.lb-close').addEventListener('click', close);
  lightbox.querySelector('.lb-prev').addEventListener('click', function () { show(current - 1); });
  lightbox.querySelector('.lb-next').addEventListener('click', function () { show(current + 1); });

  // Klik mimo fotku i mimo tlačítka zavírá.
  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) close();
  });

  document.addEventListener('keydown', function (event) {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
})();
