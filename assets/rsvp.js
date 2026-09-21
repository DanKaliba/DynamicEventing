/* ==========================================================================
   Potvrzení účasti

   Web je statický na GitHub Pages, žádný backend tu není — formulář proto
   odesílá rovnou do Google Formuláře a odpovědi padají do Sheetu.

   Bez JS to funguje taky: formulář se normálně odešle a prohlížeč skončí
   na googlovské stránce s poděkováním. Ošklivé, ale odpověď dorazí.
   S JS míří odeslání do schovaného <iframe>, takže návštěvník zůstane na
   stránce a poděkování ukážeme ve vlastním designu.

   Čemu se nedá vyhnout: prohlížeč kvůli pravidlům pro cizí domény
   neprozradí, co Google odpověděl. Událost load na iframu znamená jen
   „něco se vrátilo", ne „uloženo". Pro jistotu je pod formulářem e-mail.
   ========================================================================== */

(function () {
  'use strict';

  var formular = document.getElementById('rsvp');
  if (!formular) return;

  var dekujeme = document.getElementById('rsvp-dekujeme');
  var chyba = document.getElementById('rsvp-chyba');
  var tlacitko = formular.querySelector('button[type="submit"]');

  /* ---------- Nevyplněná adresa formuláře ----------
     Dokud v action zůstane zástupný text, odesílání by tiše mizelo
     v prázdnu. To je horší než žádný formulář — chybějící potvrzení
     účasti se pozná až podle prázdných židlí. Radši ho schovat. */

  if (formular.getAttribute('action').indexOf('__ID_FORMULARE__') !== -1) {
    formular.hidden = true;
    if (chyba) {
      chyba.hidden = false;
      chyba.textContent = 'Formulář ještě není napojený — napište nám prosím e-mailem.';
      formular.parentNode.insertBefore(chyba, formular.nextSibling);
    }
    if (window.console) {
      console.warn('rsvp.js: v index.html není doplněná adresa Google Formuláře ' +
                   'ani ID polí (entry.*). Formulář je proto schovaný.');
    }
    return;
  }

  /* ---------- Pole, která nedávají smysl při omluvě ---------- */

  var jenPriUcasti = Array.prototype.slice.call(
    formular.querySelectorAll('.jen-pri-ucasti'));
  var prepinaceUcasti = Array.prototype.slice.call(
    formular.querySelectorAll('[data-ucast]'));

  function prekreslit() {
    var prijedou = true;
    prepinaceUcasti.forEach(function (p) {
      if (p.checked) prijedou = p.getAttribute('data-ucast') === 'ano';
    });
    jenPriUcasti.forEach(function (pole) {
      pole.hidden = !prijedou;
    });
  }

  prepinaceUcasti.forEach(function (p) {
    p.addEventListener('change', prekreslit);
  });
  prekreslit();

  /* ---------- Odeslání do schovaného rámu ---------- */

  var ram = document.createElement('iframe');
  ram.name = 'rsvp-cil';
  ram.hidden = true;
  ram.setAttribute('aria-hidden', 'true');
  ram.setAttribute('tabindex', '-1');
  formular.parentNode.appendChild(ram);

  // Teprve teď, když rám existuje: bez JS zůstane target prázdný
  // a formulář se odešle klasickou cestou.
  formular.target = 'rsvp-cil';

  var odeslano = false;
  var hlidac;

  function hotovo() {
    clearTimeout(hlidac);
    formular.hidden = true;
    if (chyba) chyba.hidden = true;
    if (dekujeme) {
      dekujeme.hidden = false;
      // Přesunout fokus, aby odečítač obrazovky poděkování oznámil.
      dekujeme.setAttribute('tabindex', '-1');
      dekujeme.focus();
    }
  }

  function selhalo() {
    odeslano = false;
    tlacitko.disabled = false;
    tlacitko.textContent = 'Odeslat';
    if (chyba) {
      chyba.hidden = false;
      chyba.textContent = 'Odeslání se nepovedlo. Zkuste to prosím znovu, ' +
        'nebo nám napište e-mailem.';
    }
  }

  ram.addEventListener('load', function () {
    // Rám se načte i hned po vložení do stránky, ještě před odesláním.
    if (odeslano) hotovo();
  });

  formular.addEventListener('submit', function () {
    odeslano = true;
    tlacitko.disabled = true;
    tlacitko.textContent = 'Odesílám…';
    if (chyba) chyba.hidden = true;

    // Kdyby se rám nikdy nenačetl (spadlá síť, blokovaný Google),
    // ať tlačítko nezůstane navždy šedé.
    hlidac = setTimeout(selhalo, 12000);
  });
})();
