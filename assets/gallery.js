/* ==========================================================================
   Fotogalerie — JEDINÉ místo, kde se přidávají fotky.
   --------------------------------------------------------------------------
   Postup:
     1. Nahraj soubory do assets/img/
     2. Přidej sem řádek podle vzoru níž
     3. git add -A && git commit -m "Fotky" && git push

   popis        krátce, co je na fotce. Pro odečítače obrazovky a pro případ,
                že se obrázek nenačte. Není volitelný.
   sirka/vyska  rozměry v pixelech. Volitelné, ale bez nich stránka při
                načítání fotek poskakuje.

   Doporučení: šířka max 2000 px, JPEG kvalita ~80, soubor pod 500 kB.
   Názvy bez diakritiky a mezer: obrad-01.jpg
   ========================================================================== */

window.GALERIE = [
  // { src: 'assets/img/obrad-01.jpg', popis: 'Obřad na louce', sirka: 2000, vyska: 1333 },
  // { src: 'assets/img/ohen.jpg',     popis: 'Oheň za chalupou', sirka: 2000, vyska: 2500 },
];
