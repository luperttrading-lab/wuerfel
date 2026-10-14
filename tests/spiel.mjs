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

// ruhig = reduzierte Bewegung: Würfel bremst in 0,25 s statt bis zu 1,5 s – nur für schnelle Durchläufe
async function seite(breite, hoehe, ruhig = false) {
  const ctx = await browser.newContext({
    viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    reducedMotion: ruhig ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const konsole = [];
  page.on('pageerror', e => konsole.push(e.message));
  page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
  await page.goto(url);
  return { page, konsole, ctx };
}
const phase = page => page.evaluate(() => window.wuerfelSpiel.phase);
async function anhalten(page) {
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'dreht');
  await page.click('#wuerfel', { force: true });
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage', null, { timeout: 4000 });
  return page.evaluate(() => window.wuerfelSpiel.zahl);
}

console.log('Startseite');
{
  const { page, konsole, ctx } = await seite(390, 844);
  const v = await page.evaluate(() => APP_VERSION);
  ok(await page.textContent('#version') === 'v' + v, 'Versionsnummer steht im Kopf');
  ok(await page.isHidden('#update'), 'Update-Banner ist anfangs verborgen');
  ok(await page.isVisible('#startseite') && await page.isHidden('#spielseite'), 'App startet mit der Startseite');
  ok((await page.textContent('#startseite h2')).includes('zerlegen'), 'Frage „Welche Zahl zerlegen wir?“');
  const wahl = await page.$$eval('#zahlwahl button', bs => bs.map(b => b.textContent).join(','));
  ok(wahl === '4,5,6,7,8,9,10', `Auswahl 4 bis 10 (${wahl})`);
  if (bilder) await page.screenshot({ path: `${bilder}/0-start.png` });

  console.log('Spiel mit echter Bewegung');
  await page.click('#zahlwahl button[data-n="10"]');
  ok(await page.isVisible('#spielseite') && await page.isHidden('#startseite'), 'Nach der Wahl: Spielseite');
  ok(await page.locator('.zahl').count() === 11, 'Zerlegen der 10: Knöpfe 0–10');
  ok(await phase(page) === 'dreht', 'Würfel dreht sich sofort');
  const ziffern = new Set();
  for (let i = 0; i < 10; i++) { ziffern.add(await page.textContent('#augenzahl')); await page.waitForTimeout(60); }
  const dreh = await page.evaluate(() => document.querySelector('#wuerfel').style.transform);
  ok(ziffern.size >= 3 && dreh.startsWith('rotate'), `Im Leerlauf wechseln Ziffern (${ziffern.size} verschiedene) und er dreht sich`);
  if (bilder) await page.screenshot({ path: `${bilder}/1-dreht.png` });

  await page.click('.zahl[data-zahl="4"]');
  ok(await phase(page) === 'dreht', 'Zahl antippen, während er sich dreht, zählt nicht');

  const t0 = Date.now();
  await page.click('#wuerfel', { force: true });
  ok(await phase(page) === 'bremst', 'Antippen: Würfel bremst');
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage', null, { timeout: 4000 });
  const dauer = Date.now() - t0;
  ok(dauer >= 300 && dauer <= 2200, `Auslauf dauert ${dauer} ms (0,3–2,2 s)`);
  const k = await page.evaluate(() => window.wuerfelSpiel.zahl);
  ok(await page.textContent('#augenzahl') === String(k), `Würfel zeigt die gezogene Zahl ${k}`);
  ok(await page.evaluate(() => document.querySelector('#wuerfel').style.transform) === '', 'Würfel steht danach gerade');
  ok((await page.textContent('#gleichung')).replace(/\s/g, '') === `${k}+?=10`, 'Gleichung „k + ? = 10“');
  if (bilder) await page.screenshot({ path: `${bilder}/2-frage.png` });

  const falsch = k === 5 ? 4 : k;                     // k selbst ist falsch, außer bei 5
  await page.click(`.zahl[data-zahl="${falsch}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('falsch')), 'Falsche Zahl: roter Hintergrund');
  ok(await phase(page) === 'frage', 'Falsche Zahl: Frage bleibt offen');
  await page.waitForTimeout(300);
  if (bilder) await page.screenshot({ path: `${bilder}/3-falsch.png` });

  const sterne = await page.evaluate(() => window.wuerfelSpiel.stand.sterne);
  await page.click(`.zahl[data-zahl="${10 - k}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('gut')), 'Richtige Zahl: grüner Hintergrund');
  ok(await page.evaluate(() => window.wuerfelSpiel.stand.sterne) === sterne + 1, 'Richtige Zahl: ein Stern mehr');
  ok((await page.textContent('#gleichung')).replace(/\s/g, '') === `${k}+${10 - k}=10`, `Lösung steht da: ${k} + ${10 - k} = 10`);
  await page.waitForTimeout(500);
  if (bilder) await page.screenshot({ path: `${bilder}/4-richtig.png` });
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'dreht', null, { timeout: 4000 });
  ok(true, 'Danach dreht er sich von selbst weiter');

  await page.click('#zurueck');
  ok(await page.isVisible('#startseite'), 'Zurück-Knopf führt zur Startseite');
  ok(await page.getAttribute('#zahlwahl button[data-n="10"]', 'class') === 'zuletzt', 'Zuletzt gewählte Zahl ist markiert');

  // Banner überlagert, schiebt nicht
  const vor = await page.evaluate(() => [document.querySelector('#zahlwahl').getBoundingClientRect().top, document.documentElement.scrollHeight]);
  await page.evaluate(() => showInfo('Test', 0));
  await page.waitForTimeout(500);
  const nach = await page.evaluate(() => [document.querySelector('#zahlwahl').getBoundingClientRect().top, document.documentElement.scrollHeight]);
  ok(vor[0] === nach[0] && vor[1] === nach[1], 'Banner verschiebt den Inhalt nicht');

  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Ganze Runden (jede Zerlegung genau einmal)');
{
  const { page, konsole, ctx } = await seite(390, 844, true);
  for (const n of [4, 7, 10]) {
    await page.evaluate(n => window.wuerfelSpiel.starteSpiel(n), n);
    const gezogen = [];
    let alleRichtig = true;
    for (let i = 0; i <= n; i++) {
      const k = await anhalten(page);
      gezogen.push(k);
      await page.click(`.zahl[data-zahl="${n - k}"]`);
      if (await phase(page) !== 'geloest') alleRichtig = false;
      if (i < n) await page.click('#wuerfel', { force: true });          // nicht auf den Takt warten
    }
    const sortiert = [...gezogen].sort((a, b) => a - b).join(',');
    ok(alleRichtig && sortiert === Array.from({ length: n + 1 }, (_, i) => i).join(','),
      `${n}: ${n + 1} Würfe zeigen jede Zahl 0–${n} genau einmal (${gezogen.join(' ')})`);
    ok((await page.textContent('#hinweis')).includes('Alle Zerlegungen'), `${n}: nach der Runde „Alle Zerlegungen geschafft“`);
    const naechste = await page.evaluate(() => window.wuerfelSpiel.beutel);
    ok(naechste.length === n + 1 && naechste[naechste.length - 1] !== gezogen[n], `${n}: neue Runde beginnt nicht mit derselben Zahl`);
  }
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Passt aufs kleine iPhone (375 × 667)');
for (const n of [4, 7, 10]) {
  const { page, ctx } = await seite(375, 667, true);
  await page.click(`#zahlwahl button[data-n="${n}"]`);
  await anhalten(page);
  const m = await page.evaluate(() => ({
    breit: document.documentElement.scrollWidth,
    letzte: document.querySelector('.zahl:last-child').getBoundingClientRect().bottom,
    knopf: document.querySelector('.zahl').getBoundingClientRect().width,
  }));
  ok(m.breit <= 375, `${n}: kein seitliches Scrollen (${m.breit} px)`);
  ok(m.letzte <= 667, `${n}: alle Zahlen ohne Scrollen sichtbar (unterste Kante ${Math.round(m.letzte)} px)`);
  ok(m.knopf >= 44, `${n}: Zahlknöpfe breit genug für Kinderfinger (${Math.round(m.knopf)} px)`);
  if (bilder) await page.screenshot({ path: `${bilder}/se-${n}.png` });
  await ctx.close();
}

console.log('Zufall (χ²-Test, α = 0,001)');
{
  const { page, ctx } = await seite(390, 844, true);
  // kritische Werte χ²(df; 0,999)
  for (const [m, krit] of [[5, 18.467], [11, 29.588]]) {
    const r = await page.evaluate(m => {
      const N = 200000, h = new Array(m).fill(0);
      for (let i = 0; i < N; i++) h[window.wuerfelSpiel.zufall(m)]++;
      const e = N / m; let chi = 0;
      for (const x of h) chi += (x - e) ** 2 / e;
      return chi;
    }, m);
    ok(r < krit, `zufall(${m}) gleichverteilt: χ² = ${r.toFixed(1)} < ${krit} (df ${m - 1})`);
  }
  // Erste Zahl einer Runde: gleichverteilt über 0..10 (ohne Ausschluss-Regel)
  const r = await page.evaluate(() => {
    const N = 50000, h = new Array(11).fill(0);
    for (let i = 0; i < N; i++) { const b = window.wuerfelSpiel.neuerBeutel(10, null); h[b[b.length - 1]]++; }
    const e = N / 11; let chi = 0;
    for (const x of h) chi += (x - e) ** 2 / e;
    return chi;
  });
  ok(r < 29.588, `Erste Zahl einer Runde gleichverteilt: χ² = ${r.toFixed(1)} < 29.588 (df 10)`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
