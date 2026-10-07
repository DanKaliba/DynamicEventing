/* ==========================================================================
   Pixel art pro hru na konci stránky (assets/hra.js)

   Každý obrázek je pole řádků, jeden znak = jeden pixel, '.' = průhledná.
   Barvy podle PALETY níž. Postavy se kreslí natočené doprava, doleva se
   zrcadlí samy. Všechny řádky jednoho obrázku musí mít stejnou délku —
   kratší/delší řádek se v konzoli ohlásí.

   Ája je Malá My z Mumínků, Dan podle fotek ve fotky/ (ty do gitu
   nejdou). Rozměry postav se můžou měnit, hra si je přečte odsud.
   ========================================================================== */

window.HRA_SPRITY = (function () {
  'use strict';

  var PALETA = {
    k: '#1B1B1B',   // obrys, brýle, Ájiny nohy a ruce
    s: '#F4C9A3',   // kůže
    w: '#FFFFFF',   // zuby
    o: '#E8862A',   // Ájiny vlasy
    O: '#B65D14',
    p: '#F4A6C0',   // mašle
    r: '#D7262E',   // Ájiny šaty
    R: '#8E1218',   // pusa, lem šatů
    m: '#CFEAF7',   // led
    b: '#3B2614',   // Danovy kudrny
    B: '#2A1A0E',   // vousy
    c: '#2F6FD6',   // Danova bunda — modrá
    C: '#1D4796',   //   zip
    v: '#D23B2E',   //   a červená
    j: '#4A4F57',   // šedé kalhoty
    n: '#C9962A',   // pohorky
    y: '#F2C94C',   // zlato
    Y: '#C9962A',
    g: '#B4B9BD',   // plech schránky
    G: '#5F666B',
    h: '#9A5B2A',   // čaj
    M: '#8FC3E0',   // led
    e: '#F3F5EC',
    x: '#E33B4B'    // srdce
  };

  // ---------- Ája ----------
  // Malá My z Mumínků: oranžový drdol, červené šaty, růžová mašle,
  // ruce v bok. Takhle ji Daník chce — neměnit.
  var ajaHlava = [
    '....oo....',
    '...oOOo...',
    '....oo....',
    '..oooooo..',
    '.oooooooo.',
    '.osssssso.',
    '.ssskssks.',
    '.ssssssss.',
    '..sssRss..',
    '....pp....',
    '..rrrrrr..'
  ];
  var aja = {
    stoji: ajaHlava.concat([
      '.krrrrrrk.',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      '...k..k...',
      '..kk.kk...'
    ]),
    krok1: ajaHlava.concat([
      '.krrrrrrk.',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      '..k....k..',
      '.kk....kk.'
    ]),
    krok2: ajaHlava.concat([
      '.krrrrrrk.',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      '....kk....',
      '...kkk....'
    ]),
    skok: ajaHlava.concat([
      'krrrrrrrrk',
      'rrrrrrrrrr',
      'RrrrrrrrrR',
      '..k....k..',
      '.k......k.'
    ]),
    // Bolí zub: ruka na tváři, pusa dolů.
    bolest: [
      '....oo....',
      '...oOOo...',
      '....oo....',
      '..oooooo..',
      '.oooooooo.',
      '.osssssso.',
      '.ssskssksk',
      '.sssssskk.',
      '..sRRRsk..',
      '....pp.k..',
      '..rrrrrr..',
      '.krrrrrrr.',
      '.rrrrrrrr.',
      'rrrrrrrrrr',
      '...k..k...',
      '..kk.kk...'
    ]
  };

  // ---------- Dan ----------
  // Podle fotek: krátké tmavé vlasy, brýle, plnovous, modro-červená bunda,
  // šedé kalhoty, pohorky. Hlava 8 řádků + trup 5 + nohy 5 = 18 px.
  // Obličej drží šířku sloupců 1–8, nic nevyčnívá dopředu (jinak to
  // vypadá jako velký nos).
  var DAN = {
    hlava: [
      '..bbbbbb..',
      '.bbbbbbbb.',
      '.bssssssb.',
      '.bkkskksb.',
      '.BssssssB.',
      '.BBswwsBB.',
      '..BBBBBB..',
      '...BBBB...'
    ],
    trup: [
      '..vccccv..',
      '.vccccccv.',
      '.vcccCccv.',
      '.vccccccv.',
      '.sccccccs.'
    ]
  };

  var NOHY = {
    stoji: ['..jjjjjj..', '..jj..jj..', '..jj..jj..', '..jj..jj..', '..nnn.nnn.'],
    krok1: ['..jjjjjj..', '.jj....jj.', '.jj....jj.', '.jj....jj.', 'nnn....nnn'],
    krok2: ['...jjjj...', '...jjjj...', '...jjjj...', '...jjjj...', '...nnnnn..'],
    skok:  ['..jjjjjj..', '.jj....jj.', 'nn.....jj.', '.......nn.', '..........'],
    klek:  ['..jjjjjjj.', '..jj...jj.', '.nnn...nn.']
  };

  var horni = DAN.hlava.concat(DAN.trup);
  var dan = {};
  ['stoji', 'krok1', 'krok2', 'skok'].forEach(function (k) { dan[k] = horni.concat(NOHY[k]); });
  // Na jedno koleno, ruka s prstenem natažená dopředu.
  dan.klek = horni.slice(0, -2)
    .concat([DAN.trup[3].slice(0, 7) + 'sss'])
    .concat([NOHY.stoji[0]].concat(NOHY.klek));

  // ---------- Věci ----------
  var veci = {
    prasek: [
      'GGGGGGG',
      'GwwwwwG',
      'GwwxwwG',
      'GwxxxwG',
      'GwwxwwG',
      'GwwwwwG',
      'GGGGGGG'
    ],
    caj: [
      '.w..w..',
      '..w..w.',
      'GGGGG..',
      'GhhhGGG',
      'GwwwG.G',
      'GwwwGGG',
      '.GGG...'
    ],
    led: [
      '..GG...',
      '.GmmG..',
      'GmmmmG.',
      'GmMmmmG',
      'GmmmMmG',
      'GmmmmmG',
      '.GGGGG.'
    ],
    srdce: [
      '.x.x.',
      'xxxxx',
      'xxxxx',
      '.xxx.',
      '..x..'
    ],
    klic: [
      '.yy....',
      'y..yyyy',
      '.yy..y.'
    ],
    cepice: [
      '...k...',
      'kkkkkkk',
      '..kkk.y',
      '..kkk.y'
    ],
    // Lezecký batoh (stojí na plošině s lezením)
    batoh: [
      '..kk..',
      '.RRRR.',
      'RRRRRR',
      'vvvvvv',
      'kkkkkk',
      'vvvvvv',
      'vRRRRv',
      'vRRRRv',
      '.vvvv.'
    ],
    // Lano svázané do panenky: nahoře omotávka, pod ní dvě smyčky
    // různé délky, dole zakulacené
    panenka: [
      '...YY...',
      '..YyyY..',
      '..YYYY..',
      '..yYYy..',
      '.yy..yy.',
      '.y.yy.y.',
      'y..yy..y',
      'y.y..y.y',
      'y.y..y.y',
      'y.yyyy.y',
      '.y....y.',
      '..yyyy..'
    ],
    prsten: [
      '..w..',
      '.yYy.',
      'y...y',
      'y...y',
      '.yyy.'
    ],
    schranka: [
      'GGGGGGGGG',
      'GgggggggG',
      'GGGGGGGGG',
      'GgggggggG',
      'GgggggggG',
      'GgggggggG',
      'GGGGGGGGG'
    ],
    schrankaOtevrena: [
      'GGGG.....',
      'GgggG....',
      'GGGGGGGGG',
      'GeeeeeeeG',
      'GeeeeeeeG',
      'GgggggggG',
      'GGGGGGGGG'
    ]
  };

  function vyrob(nazev, radky, zrcadlit) {
    var w = radky[0].length, h = radky.length;
    radky.forEach(function (r, i) {
      if (r.length !== w) console.warn('Sprite ' + nazev + ': řádek ' + i + ' má ' + r.length + ' znaků místo ' + w);
    });
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      for (var i = 0; i < w; i++) {
        var ch = radky[y][zrcadlit ? w - 1 - i : i];
        if (!ch || ch === '.' || !PALETA[ch]) continue;
        x.fillStyle = PALETA[ch];
        x.fillRect(i, y, 1, 1);
      }
    }
    return c;
  }

  // Každý obrázek jako { p: doprava, l: doleva, w, h }.
  function sada(nazev, data) {
    var out = {};
    Object.keys(data).forEach(function (k) {
      out[k] = {
        p: vyrob(nazev + '.' + k, data[k], false),
        l: vyrob(nazev + '.' + k, data[k], true),
        w: data[k][0].length,
        h: data[k].length
      };
    });
    return out;
  }

  return {
    aja: sada('aja', aja),
    dan: sada('dan', dan),
    veci: sada('veci', veci)
  };
})();
