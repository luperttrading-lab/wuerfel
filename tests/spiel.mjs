// Prüft das Spiel im echten Browser: node tests/spiel.mjs [bildordner]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bilder = process.argv[2];
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(wurzel, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(wurzel) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': typen[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

let fehler = 0;
const ok = (bed, text) => { console.log((bed ? '  ok   ' : '  FEHLER ') + text); if (!bed) fehler++; };

const browser = await pw.chromium.launch();

async function seite(breite, hoehe) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const konsole = [];
  page.on('pageerror', e => konsole.push(e.message));
  page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
  await page.goto(url);
  return { page, konsole, ctx };
}
const wuerfle = async page => {
  await page.click('#wuerfel');
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage');
  return page.evaluate(() => window.wuerfelSpiel.zahl);
};

console.log('Grundlagen');
{
  const { page, konsole, ctx } = await seite(390, 844);
  const v = await page.evaluate(() => APP_VERSION);
  ok(await page.textContent('#version') === 'v' + v, 'Versionsnummer steht im Kopf');
  ok(await page.isHidden('#update'), 'Update-Banner ist anfangs verborgen');
  ok(await page.locator('.zahl').count() === 7, 'Würfel bis 6: Knöpfe 0–6');
  ok((await page.textContent('#frage')).includes('Tippe'), 'Startet mit Aufforderung zu würfeln');
  if (bilder) await page.screenshot({ path: `${bilder}/0-start.png` });

  await page.click('.zahl[data-zahl="3"]');
  ok(await page.evaluate(() => window.wuerfelSpiel.phase) === 'bereit', 'Zahl antippen vor dem Würfeln tut nichts');

  for (const max of [6, 10, 20]) {
    await page.click(`.chip[data-max="${max}"]`);
    ok(await page.locator('.zahl').count() === max + 1, `Würfel bis ${max}: ${max + 1} Knöpfe 0–${max}`);
    let stimmt = true;
    for (let i = 0; i < 12; i++) {
      const n = await wuerfle(page);
      const punkte = await page.locator(max === 6 ? '.auge' : '.punkt.a, .punkt.b').count();
      const leer = max === 6 ? max - n : await page.locator('.punkt.leer').count();
      if (punkte !== n || leer !== max - n) { stimmt = false; console.log('     bei', n, ':', punkte, leer); }
      await page.click(`.zahl[data-zahl="${n}"]`);
    }
    ok(stimmt, `Würfel bis ${max}: angezeigte Punkte = gewürfelte Zahl (12 Würfe)`);
  }

  // Falsch → rot, bleibt in der Frage; richtig → grün, Stern
  await page.click('.chip[data-max="10"]');
  const n = await wuerfle(page);
  const sterneVor = await page.evaluate(() => window.wuerfelSpiel.stand.sterne);
  const falsch = (n + 1) % 11;
  await page.click(`.zahl[data-zahl="${falsch}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('falsch')), 'Falsche Zahl: roter Hintergrund');
  ok(await page.evaluate(() => window.wuerfelSpiel.phase) === 'frage', 'Falsche Zahl: Frage bleibt offen');
  if (bilder) await page.screenshot({ path: `${bilder}/1-falsch.png` });
  await page.click(`.zahl[data-zahl="${n}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('gut')), 'Richtige Zahl: grüner Hintergrund');
  ok(await page.evaluate(() => window.wuerfelSpiel.stand.sterne) === sterneVor + 1, 'Richtige Zahl: ein Stern mehr');
  ok(await page.isVisible('#ergebnis') && await page.textContent('#ergebnis') === String(n), 'Richtige Zahl: Ziffer erscheint am Würfel');
  await page.waitForTimeout(400);
  if (bilder) await page.screenshot({ path: `${bilder}/2-richtig.png` });

  // Ergänzen: 3 gewürfelt → 7 ist richtig
  await page.click('.chip[data-modus="ergaenzen"]');
  ok((await page.textContent('.chip[data-modus="ergaenzen"]')).includes('10'), 'Ergänzen-Knopf nennt die Zielzahl');
  let ergOk = true;
  for (let i = 0; i < 10; i++) {
    const m = await wuerfle(page);
    if (m !== 10 - m) {             // bei 5 wäre „5“ ja richtig
      await page.click(`.zahl[data-zahl="${m}"]`);
      if (!(await page.evaluate(() => document.body.classList.contains('falsch')))) ergOk = false;
    }
    await page.click(`.zahl[data-zahl="${10 - m}"]`);
    if (!(await page.evaluate(() => document.body.classList.contains('gut')))) ergOk = false;
    if (await page.locator('.punkt.dazu').count() !== 10 - m) ergOk = false;
  }
  ok(ergOk, 'Ergänzen bis 10: richtig ist 10 − Wurf, die Ergänzung wird grün eingezeichnet');
  ok((await page.textContent('#frage')).includes('= 10'), 'Ergänzen: Rechnung steht als Lösung da');
  if (bilder) await page.screenshot({ path: `${bilder}/3-ergaenzen.png` });

  // Einstellungen bleiben nach Neuladen
  await page.reload();
  ok(await page.evaluate(() => window.wuerfelSpiel.stand.max === 10 && window.wuerfelSpiel.stand.modus === 'ergaenzen'), 'Würfel und Aufgabe bleiben nach Neuladen');

  // Banner überlagert, schiebt nicht
  const vor = await page.evaluate(() => [document.querySelector('#wuerfel').getBoundingClientRect().top, document.documentElement.scrollHeight]);
  await page.evaluate(() => showInfo('Test', 0));
  await page.waitForTimeout(500);
  const nach = await page.evaluate(() => [document.querySelector('#wuerfel').getBoundingClientRect().top, document.documentElement.scrollHeight]);
  ok(vor[0] === nach[0] && vor[1] === nach[1], 'Banner verschiebt den Inhalt nicht');

  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Passt aufs kleine iPhone (375 × 667)');
for (const max of [6, 10, 20]) {
  const { page, ctx } = await seite(375, 667);
  await page.click(`.chip[data-max="${max}"]`);
  await wuerfle(page);
  const m = await page.evaluate(() => ({
    breit: document.documentElement.scrollWidth, hoch: document.documentElement.scrollHeight,
    letzte: document.querySelector('.zahl:last-child').getBoundingClientRect().bottom,
    knopf: document.querySelector('.zahl').getBoundingClientRect().width,
  }));
  ok(m.breit <= 375, `bis ${max}: kein seitliches Scrollen (${m.breit} px)`);
  ok(m.letzte <= 667, `bis ${max}: alle Zahlen ohne Scrollen sichtbar (unterste Kante ${Math.round(m.letzte)} px)`);
  ok(m.knopf >= 40, `bis ${max}: Zahlknöpfe breit genug für Kinderfinger (${Math.round(m.knopf)} px)`);
  if (bilder) await page.screenshot({ path: `${bilder}/se-${max}.png` });
  await ctx.close();
}

console.log('Würfel ist gleichverteilt (χ²-Test, α = 0,001)');
{
  const { page, ctx } = await seite(390, 844);
  // kritische Werte χ²(df; 0,999)
  for (const [max, krit] of [[6, 20.515], [10, 27.877], [20, 43.820]]) {
    const r = await page.evaluate(max => {
      const N = 200000, h = new Array(max + 1).fill(0);
      for (let i = 0; i < N; i++) h[window.wuerfelSpiel.wurf(max)]++;
      const e = N / max;
      let chi = 0; for (let k = 1; k <= max; k++) chi += (h[k] - e) ** 2 / e;
      return { chi, null: h[0], aus: h.length };
    }, max);
    ok(r.null === 0 && r.aus === max + 1 && r.chi < krit, `bis ${max}: nur 1–${max}, χ² = ${r.chi.toFixed(1)} < ${krit} (df ${max - 1})`);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
