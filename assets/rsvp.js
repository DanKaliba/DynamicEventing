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

  /* ---------- Texty, které skript vypisuje sám ----------
     Zbytek stránky řeší dva jazyky přes .jazyk-cs/.jazyk-en v HTML
     (viz style.css) — to tady nejde, protože tenhle text vzniká až za
     běhu. Jazyk se čte při KAŽDÉM volání, ne jednou při startu, takže
     hláška vždycky odpovídá tomu, co je zrovna přepnuté na stránce. */
  var TEXTY = {
    cs: {
      nenapojeny: 'Formulář ještě není napojený — napište nám prosím e-mailem.',
      odesilam: 'Odesílám…',
      odeslat: 'Odeslat',
      selhalo: 'Odeslání se nepovedlo. Zkuste to prosím znovu, nebo nám ' +
        'napište e-mailem.'
    },
    en: {
      nenapojeny: 'The form isn’t connected yet — please email us instead.',
      odesilam: 'Sending…',
      odeslat: 'Send',
      selhalo: 'Sending failed. Please try again, or email us instead.'
    }
  };

  function text(klic) {
    var jazyk = document.documentElement.getAttribute('data-jazyk') === 'en' ? 'en' : 'cs';
    return TEXTY[jazyk][klic];
  }

  /* ---------- Nevyplněná adresa formuláře ----------
     Dokud v action zůstane zástupný text, odesílání by tiše mizelo
     v prázdnu. To je horší než žádný formulář — chybějící potvrzení
     účasti se pozná až podle prázdných židlí. Radši ho schovat. */

  if (formular.getAttribute('action').indexOf('__ID_FORMULARE__') !== -1) {
    formular.hidden = true;
    if (chyba) {
      chyba.hidden = false;
      chyba.textContent = text('nenapojeny');
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
    tlacitko.textContent = text('odeslat');
    if (chyba) {
      chyba.hidden = false;
      chyba.textContent = text('selhalo');
    }
  }

  ram.addEventListener('load', function () {
    // Rám se načte i hned po vložení do stránky, ještě před odesláním.
    if (odeslano) hotovo();
  });

  formular.addEventListener('submit', function () {
    odeslano = true;
    tlacitko.disabled = true;
    tlacitko.textContent = text('odesilam');
    if (chyba) chyba.hidden = true;

    // Kdyby se rám nikdy nenačetl (spadlá síť, blokovaný Google),
    // ať tlačítko nezůstane navždy šedé.
    hlidac = setTimeout(selhalo, 12000);
  });
})();
