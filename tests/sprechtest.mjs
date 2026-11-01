// Prüft sprechtest.html mit einem Ersatz-Mikrofon: node tests/sprechtest.mjs folge.wav
// folge.wav: 2 s Stille, dann „sieben drei zehn null fünf eins acht zwei neun vier sechs“, je 2,2 s Pause
// (16 kHz, mono, PCM). Chromium spielt die Datei in Schleife als Mikrofon ab. Läuft rund eine Minute;
// nicht Teil von tests/spiel.mjs, weil Sprachaufnahmen nicht im Repo liegen.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }

const wav = path.resolve(process.argv[2] || '');
if (!fs.existsSync(wav)) { console.log('Aufruf: node tests/sprechtest.mjs folge.wav'); process.exit(2); }
const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  const p = path.join(wurzel, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(wurzel) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': typen[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

let fehler = 0;
const ok = (bed, text) => { console.log((bed ? '  ok   ' : '  FEHLER ') + text); if (!bed) fehler++; };
const browser = await pw.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] });
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(e.message));
const ZIELE = '7,3,10,0,5,1,8,2,9,4,6';

console.log('Sprechtest: Zahlen per Sprache (Ersatz-Mikrofon)');
for (const lauf of ['erstes Mal', 'zweites Mal (aus dem Speicher)']) {
  await page.goto(url + 'sprechtest.html?ziele=' + ZIELE);
  const t0 = Date.now();
  await page.click('#los');
  await page.waitForFunction(() => window.sprechtest.zustand.phase === 'bereit', null, { timeout: 120000 });
  const laden = (Date.now() - t0) / 1000;
  ok(true, `${lauf}: Sprachmodell geladen in ${laden.toFixed(1)} s`);
  if (lauf.startsWith('zweites')) break;
}
await page.click('#los');                                // Mikrofon an
await page.waitForFunction(() => window.sprechtest.zustand.phase === 'fertig', null, { timeout: 120000 });
const r = await page.evaluate(() => window.sprechtest.zustand.runde);
const richtig = r.filter(x => x.ok).length;
ok(r.length === 20 && richtig >= 19, `${richtig} von ${r.length} gesprochenen Zahlen richtig verstanden (${r.map(x => x.ok ? x.ziel : `${x.ziel}→${x.gehoert}`).join(' ')})`);
const zeiten = r.map(x => x.dauer).filter(x => x != null);
ok(zeiten.length > 0, `Antwort der Erkennung im Mittel ${(zeiten.reduce((a, b) => a + b, 0) / zeiten.length).toFixed(2)} s nach dem ersten erkannten Laut`);
ok(await page.evaluate(() => window.sprechtest.zahlAus('[unk] fünf') === 5 && window.sprechtest.zahlAus('[unk]') === null && window.sprechtest.zahlAus('ein') === 1),
  'Zahlwort aus dem Text: „ähm fünf“ → 5, Geräusch → nichts, „ein“ → 1');
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));

// Im Spiel: Sprechen an (3 s auf 🔊 – hier direkt gespeichert), dann hört die App während der 2 Minuten zu
for (const fassung of ['sagen', 'tippen']) {
  console.log(`Spiel mit Sprechen, Fassung „${fassung === 'sagen' ? 'nur Würfel' : 'mit Zahlen unten'}“`);
  await page.goto(url);
  await page.evaluate(f => localStorage.setItem('wuerfel.stand', JSON.stringify({ n: 10, sprechen: true, fassung: f })), fassung);
  await page.goto(url);
  await page.click('#zahlwahl button[data-n="10"]');
  await page.waitForFunction(() => window.wuerfelSpiel.sprache.bereit, null, { timeout: 60000 });
  await page.click('#los');
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'rollt', null, { timeout: 15000 });
  ok(await page.evaluate(() => window.wuerfelSpiel.sprache.hoert), 'Erst das Mikrofon, dann der erste Wurf: beim ersten Rollen kommt schon Ton an');
  await page.waitForFunction(() => window.wuerfelSpiel.sprache.hoert, null, { timeout: 15000 });
  await page.waitForTimeout(40000);                       // gut eine Runde der Aufnahme (11 Zahlen, 36 s)
  const m = await page.evaluate(() => ({ uhr: window.wuerfelSpiel.uhr, p: window.wuerfelSpiel.sprache.protokoll }));
  const stimmt = m.p.every(x => x.richtig === (x.gesagt === 10 - x.zahl));
  ok(m.p.length >= 8, `${m.p.length} gesagte Zahlen erkannt (${m.p.map(x => x.gesagt).join(' ')})`);
  ok(stimmt && m.uhr.richtig === m.p.filter(x => x.richtig).length && m.uhr.falsch === m.p.length - m.uhr.richtig,
    `Richtig/falsch stimmt bei jeder (Würfel ${m.p.map(x => x.zahl).join(' ')} → ${m.uhr.richtig} richtig, ${m.uhr.falsch} falsch)`);
  ok(m.uhr.versuche >= m.p.length, `Nach jeder gesagten Zahl ging es von selbst weiter: ${m.uhr.versuche} Würfe ohne Antippen`);
  if (fassung === 'sagen') ok(m.uhr.versuche === m.p.length + 1 || m.uhr.versuche === m.p.length, '„nur Würfel“: jede Zahl würfelt sofort neu');
  await page.click('#zurueck');
  ok(!(await page.evaluate(() => window.wuerfelSpiel.sprache.hoert)), 'Zurück: das Mikrofon ist aus');
}
ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
await browser.close();
server.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
