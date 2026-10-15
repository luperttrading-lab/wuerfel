// Baut tiere/N.webp aus tiere/quelle/N.svg (gezeichnet, warm, mit Papierstruktur).
// Die Papierstruktur sind SVG-Filter; die rendert nicht jeder Browser gleich (Safari!),
// darum wird hier einmal in Chromium gerastert und das fertige Bild ausgeliefert.
// Aufruf im Projektordner: node tools/tiere.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'fs';

const GROESSE = 640;   // größte Anzeige 210 px × 3 (Retina) = 630 px
const GUETE = 0.82;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const n of [4, 5, 6, 7, 8, 9, 10]) {
  const svg = readFileSync(`tiere/quelle/${n}.svg`, 'utf8');
  const url = await page.evaluate(async ({ svg, g, q }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = g;
    c.getContext('2d').drawImage(img, 0, 0, g, g);
    return c.toDataURL('image/webp', q);
  }, { svg, g: GROESSE, q: GUETE });
  const bild = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(`tiere/${n}.webp`, bild);
  console.log(`tiere/${n}.webp  ${(bild.length / 1024).toFixed(1)} KB`);
}
await browser.close();
