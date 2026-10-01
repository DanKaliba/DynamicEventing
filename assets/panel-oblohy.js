/* ==========================================================================
   Ovládací panel oblohy — jen pro ladění, načítá se s ?panel v URL

   Posuvník času, výběr barev vrchu a obzoru pro každý opěrný bod dne,
   kontrola kontrastu. Úpravy se drží v localStorage tohohle prohlížeče;
   natrvalo se dostanou na web až tlačítkem "Kopírovat tabulku" a vložením
   do OBLOHA v assets/obloha.js.
   ========================================================================== */

(function () {
  'use strict';

  var O = window.Obloha;
  if (!O) return;

  var KLIC = 'panel-oblohy';
  var VYCHOZI = JSON.parse(JSON.stringify(O.tabulka));

  try {
    var ulozeno = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (Array.isArray(ulozeno) && ulozeno.length === O.tabulka.length) {
      ulozeno.forEach(function (radek, i) { O.tabulka[i] = radek; });
      O.prekreslit();
    }
  } catch (e) {}

  function ulozit() {
    try { localStorage.setItem(KLIC, JSON.stringify(O.tabulka)); } catch (e) {}
  }

  function cas(h) {
    var hod = Math.floor(h), min = Math.round((h - hod) * 60);
    if (min === 60) { hod++; min = 0; }
    return hod + ':' + ('0' + min).slice(-2);
  }

  var css = '' +
    '.po{position:fixed;right:12px;bottom:12px;z-index:9999;width:340px;max-height:85vh;' +
    'display:flex;flex-direction:column;background:#fff;color:#1a1a1a;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.3);font:13px/1.4 system-ui,sans-serif}' +
    '.po *{box-sizing:border-box}' +
    '.po-hlava{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;' +
    'border-bottom:1px solid #ddd;font-weight:600;cursor:pointer;user-select:none}' +
    '.po-telo{overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px}' +
    '.po.zavreny .po-telo{display:none}' +
    '.po-cas{display:flex;align-items:center;gap:8px}' +
    '.po-cas input{flex:1}' +
    '.po-cas strong{width:3.2em;text-align:right;font-variant-numeric:tabular-nums}' +
    '.po-tlacitka{display:flex;gap:6px;flex-wrap:wrap}' +
    '.po button{font:inherit;padding:4px 10px;border:1px solid #bbb;border-radius:6px;background:#f6f6f6;color:inherit;cursor:pointer}' +
    '.po button:hover{background:#e9e9e9}' +
    '.po-stav{padding:8px;border-radius:6px;background:#f3f3f3}' +
    '.po-stav.varovani{background:#fff4d6}' +
    '.po-vzorky{display:flex;gap:4px;margin-top:6px}' +
    '.po-vzorky span{flex:1;height:18px;border-radius:3px;border:1px solid rgba(0,0,0,.15)}' +
    '.po table{width:100%;border-collapse:collapse}' +
    '.po th{text-align:left;font-weight:500;color:#666;padding:2px 4px}' +
    '.po td{padding:2px 4px}' +
    '.po tr.aktivni td{background:#eef4ff}' +
    '.po input[type=number]{width:4.2em;font:inherit;padding:2px}' +
    '.po input[type=color]{width:34px;height:24px;padding:0;border:1px solid #bbb;border-radius:4px;background:none;cursor:pointer}' +
    '.po textarea{width:100%;height:120px;font:11px/1.4 monospace}';

  var styl = document.createElement('style');
  styl.textContent = css;
  document.head.appendChild(styl);

  function postavit() {
    var panel = document.createElement('div');
    panel.className = 'po';
    panel.innerHTML =
      '<div class="po-hlava"><span>Obloha</span><span class="po-sipka">▾</span></div>' +
      '<div class="po-telo">' +
        '<div class="po-cas"><input type="range" min="0" max="24" step="0.0833"><strong></strong></div>' +
        '<div class="po-tlacitka">' +
          '<button data-akce="prehrat">▶ Přehrát den</button>' +
          '<button data-akce="ted">Teď</button>' +
        '</div>' +
        '<div class="po-stav"></div>' +
        '<table><thead><tr><th></th><th>hodina</th><th>vrch</th><th>obzor</th><th></th></tr></thead><tbody></tbody></table>' +
        '<div class="po-tlacitka">' +
          '<button data-akce="kopirovat">Kopírovat tabulku</button>' +
          '<button data-akce="reset">Zpět na výchozí</button>' +
        '</div>' +
        '<textarea readonly hidden></textarea>' +
      '</div>';
    document.body.appendChild(panel);

    var posuvnik = panel.querySelector('input[type=range]');
    var stitek = panel.querySelector('.po-cas strong');
    var stav = panel.querySelector('.po-stav');
    var telo = panel.querySelector('tbody');
    var vystup = panel.querySelector('textarea');
    var prehrava = null;

    panel.querySelector('.po-hlava').addEventListener('click', function () {
      panel.classList.toggle('zavreny');
      panel.querySelector('.po-sipka').textContent = panel.classList.contains('zavreny') ? '▸' : '▾';
    });

    function radky() {
      telo.innerHTML = '';
      O.tabulka.forEach(function (r, i) {
        var kraj = i === 0 || i === O.tabulka.length - 1;
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + r[3] + '</td>' +
          '<td><input type="number" min="0" max="24" step="0.25" value="' + r[0] + '"' + (kraj ? ' disabled' : '') + '></td>' +
          '<td><input type="color" value="' + r[1].toLowerCase() + '"></td>' +
          '<td><input type="color" value="' + r[2].toLowerCase() + '"></td>' +
          '<td><button title="Ukázat tuhle dobu">→</button></td>';
        var vstupy = tr.querySelectorAll('input');

        vstupy[0].addEventListener('change', function () {
          var h = parseFloat(this.value);
          var pred = O.tabulka[i - 1][0], po = O.tabulka[i + 1][0];
          // Pořadí musí zůstat — mezi sousedy, jinak by se interpolace zamotala.
          h = Math.max(pred, Math.min(po, isNaN(h) ? r[0] : h));
          this.value = h;
          r[0] = h;
          zmeneno();
        });
        vstupy[1].addEventListener('input', function () { r[1] = this.value.toUpperCase(); zmeneno(); });
        vstupy[2].addEventListener('input', function () { r[2] = this.value.toUpperCase(); zmeneno(); });
        tr.querySelector('button').addEventListener('click', function () {
          zastavit();
          nastavitHodinu(r[0] >= 24 ? 23.99 : r[0]);
        });
        telo.appendChild(tr);
      });
    }

    function zmeneno() {
      ulozit();
      O.prekreslit();
      ukazatStav();
    }

    function nastavitHodinu(h) {
      O.nastavitHodinu(h);
      ukazatStav();
    }

    function ukazatStav() {
      var h = O.hodina();
      posuvnik.value = h;
      stitek.textContent = cas(h);

      var v = O.spocitat(h);
      var c = v.css;
      stav.className = 'po-stav' + (v.info.upravenVrch ? ' varovani' : '');
      stav.innerHTML =
        'Kontrast textu <strong>' + v.info.kontrast.toFixed(1) + ':1</strong> ' +
        '(text ' + (c['--hero-text'] === '#0C1A06' ? 'tmavý' : 'světlý') + ')' +
        (v.info.upravenVrch
          ? '<br>Vrch upraven kvůli čitelnosti: ' + v.info.puvodniVrch + ' → ' + c['--hero-bg']
          : '') +
        '<div class="po-vzorky">' +
          '<span title="vrch" style="background:' + c['--hero-bg'] + '"></span>' +
          '<span title="střed" style="background:' + c['--hero-stred'] + '"></span>' +
          '<span title="obzor" style="background:' + c['--hero-obzor'] + '"></span>' +
        '</div>';

      Array.prototype.forEach.call(telo.children, function (tr, i) {
        var a = O.tabulka[i], b = O.tabulka[i + 1];
        tr.classList.toggle('aktivni', !!b && h >= a[0] && h < b[0]);
      });
    }

    function zastavit() {
      if (prehrava) { cancelAnimationFrame(prehrava); prehrava = null; }
      panel.querySelector('[data-akce=prehrat]').textContent = '▶ Přehrát den';
    }

    posuvnik.addEventListener('input', function () {
      zastavit();
      nastavitHodinu(parseFloat(posuvnik.value));
    });

    panel.addEventListener('click', function (u) {
      var akce = u.target.getAttribute && u.target.getAttribute('data-akce');
      if (akce === 'prehrat') {
        if (prehrava) { zastavit(); return; }
        u.target.textContent = '❚❚ Zastavit';
        // Celý den za 24 s — hodina za vteřinu.
        var start = performance.now(), od = O.hodina();
        (function krok(ted) {
          nastavitHodinu((od + (ted - start) / 1000) % 24);
          prehrava = requestAnimationFrame(krok);
        })(start);
      } else if (akce === 'ted') {
        zastavit();
        nastavitHodinu(null);
      } else if (akce === 'kopirovat') {
        var text = '  var OBLOHA = [\n' + O.tabulka.map(function (r, i) {
          return '    [' + (r[0] + ',').padEnd(5) + ' \'' + r[1] + '\', \'' + r[2] + '\', \'' + r[3] + '\']' +
                 (i < O.tabulka.length - 1 ? ',' : '');
        }).join('\n') + '\n  ];';
        vystup.hidden = false;
        vystup.value = text;
        vystup.select();
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      } else if (akce === 'reset') {
        if (!confirm('Zahodit úpravy barev a vrátit tabulku z obloha.js?')) return;
        VYCHOZI.forEach(function (r, i) { O.tabulka[i] = r.slice(); });
        try { localStorage.removeItem(KLIC); } catch (e) {}
        vystup.hidden = true;
        radky();
        zmeneno();
      }
    });

    radky();
    ukazatStav();
  }

  if (document.body) postavit();
  else document.addEventListener('DOMContentLoaded', postavit);
})();
