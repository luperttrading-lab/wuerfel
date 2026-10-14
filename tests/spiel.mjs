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
const gleichung = async page => (await page.textContent('#gleichung')).replace(/\s/g, '');
let RUHELAGE = null;                                   // wird nach dem Start gelesen
const lage = page => page.evaluate(() => document.querySelector('#koerper').style.transform);
// Sichtbare Abstände in der Gleichung: zwischen Textkanten, beim Lückenkasten bis zu seinem Rahmen
const abstaende = page => page.evaluate(() => {
  const gl = document.querySelector('#gleichung');
  const rahmen = parseFloat(getComputedStyle(gl).getPropertyValue('--rahmen')) * parseFloat(getComputedStyle(gl).fontSize);
  const r = [...gl.children].map(el => {
    if (el.classList.contains('luecke')) { const b = el.getBoundingClientRect(); return { left: b.left - rahmen, right: b.right + rahmen }; }
    const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect();
  });
  return r.slice(1).map((b, i) => +(b.left - r[i].right).toFixed(1));
});
const gleichmaessig = a => Math.max(...a) - Math.min(...a) <= 1.5;
const sichtbar = (page, sel) => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).visibility === 'visible', sel);
// Würfel antippen und warten, bis er liegt (rollt 2 s); force, weil Playwright sonst auf Stillstand wartet
async function wuerfle(page) {
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

  console.log('Spiel');
  await page.click('#zahlwahl button[data-n="8"]');
  ok(await page.isVisible('#spielseite') && await page.isHidden('#startseite'), 'Nach der Wahl: Spielseite');
  ok(await page.locator('.zahl').count() === 9, 'Zerlegen der 8: Knöpfe 0–8');
  ok(await phase(page) === 'bereit', 'Würfel wartet');
  ok(await page.locator('#koerper .flaeche').count() === 6, 'Würfel hat sechs Seiten');
  RUHELAGE = await lage(page);
  ok(RUHELAGE.includes('rotateX(-10deg) rotateY(-12deg)') && /scale\(1(\.0+)?\)/.test(RUHELAGE), 'Ruhelage fast von vorn (10° / 12°), volle Größe');
  const ruhe = new Set(), lagen = new Set();
  for (let i = 0; i < 8; i++) { ruhe.add(await page.textContent('#augenzahl')); lagen.add(await lage(page)); await page.waitForTimeout(80); }
  ok(ruhe.size === 1 && ruhe.has('8') && lagen.size === 1 && lagen.has(RUHELAGE), 'In Ruhe liegt er still und schräg, vorne die 8');
  ok(!(await sichtbar(page, '#gleichung')) && (await page.textContent('#hinweis')).includes('Tippe auf den Würfel'),
    'Vor der ersten Aufgabe: keine Gleichung, nur „Tippe auf den Würfel!“');
  if (bilder) await page.screenshot({ path: `${bilder}/1-bereit.png` });
  const wuerfelOben = await page.evaluate(() => document.querySelector('#wuerfel').getBoundingClientRect().top);

  await page.click('.zahl[data-zahl="4"]');
  ok(await phase(page) === 'bereit', 'Zahl antippen vor dem Würfeln zählt nicht');

  const t0 = Date.now();
  await page.click('#wuerfel', { force: true });
  ok(await phase(page) === 'rollt', 'Antippen: Würfel rollt');
  // Im Browser Bild für Bild mitschreiben – kurze Momente wie das Stauchen (≈ 0,1 s) entgehen sonst der Abtastung
  await page.evaluate(() => {
    const w = window.__messung = { lagen: [], staub: 0, seiten: [] };
    const f = () => {
      w.lagen.push(document.querySelector('#koerper').style.transform);
      w.staub = Math.max(w.staub, window.wuerfelSpiel.staub);
      w.seiten.push(JSON.stringify(window.wuerfelSpiel.seiten));
      if (window.wuerfelSpiel.phase === 'rollt') requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  let schnappschuss = false;
  while (await phase(page) === 'rollt') {
    if (!schnappschuss && Date.now() - t0 > 500) { schnappschuss = true; if (bilder) await page.screenshot({ path: `${bilder}/2-rollt.png` }); }
    await page.waitForTimeout(40);
  }
  const messung = await page.evaluate(() => window.__messung);
  const lagenRollen = new Set(messung.lagen), staubMax = messung.staub;
  const wechsel = messung.seiten.filter((x, i) => i && x !== messung.seiten[i - 1]).length;
  let verschoben = 0;
  for (const l of messung.lagen) {
    const v = l.match(/translateY\((-?[\d.]+)px\)/); if (v) verschoben = Math.max(verschoben, Math.abs(parseFloat(v[1])));
  }
  // Bewegungskurve exakt durchrechnen (in 1-ms-Schritten)
  const kurve = await page.evaluate(() => {
    const { bewegung, ROLLZEIT } = window.wuerfelSpiel;
    let kleinste = 1, flachste = 1, ersteStauchung = null;
    for (let ms = 0; ms <= ROLLZEIT; ms++) {
      const b = bewegung(ms / ROLLZEIT);
      kleinste = Math.min(kleinste, b.groesse);
      flachste = Math.min(flachste, b.flach);
      if (b.flach < 1 && ersteStauchung === null) ersteStauchung = ms;
    }
    return { kleinste, flachste, ersteStauchung };
  });
  const kleinste = kurve.kleinste, gestaucht = kurve.flachste;
  ok(kurve.ersteStauchung >= 1750 && kurve.ersteStauchung <= 1770, `„Bumm“ und Stauchen bei ${kurve.ersteStauchung} ms`);
  const dauer = Date.now() - t0;
  ok(kleinste < 0.8 && kleinste > 0.6, `Er wird beim Wirbeln kleiner und wieder groß (kleinste Größe ${Math.round(kleinste * 100)} %)`);
  const kante = await page.evaluate(() => document.querySelector('#koerper').offsetWidth);
  ok(verschoben < kante * 0.06, `Er bleibt dabei auf der Stelle (höchstens ${verschoben.toFixed(1)} px beim Stauchen)`);
  ok(gestaucht < 0.94, `Beim Aufprall staucht er sich (flach auf ${Math.round(gestaucht * 100)} %)`);
  ok(staubMax >= 10, `Beim Wirbeln fliegt Staub (bis ${staubMax} Körner gleichzeitig)`);
  ok(lagenRollen.size >= 20 && wechsel >= 6, `Beim Rollen überschlägt er sich (${lagenRollen.size} Lagen) und die Zahlen wechseln (${wechsel}×)`);
  ok(dauer >= 1900 && dauer <= 2600, `Rollen dauert ${dauer} ms (Soll 2 s)`);
  const k = await page.evaluate(() => window.wuerfelSpiel.zahl);
  ok(await page.textContent('#augenzahl') === String(k), `Würfel zeigt die gezogene Zahl ${k}`);
  ok(await lage(page) === RUHELAGE, 'Würfel liegt danach wieder in Ruhelage');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.wuerfelSpiel.staub) === 0, 'Der Staub ist verweht, kurz nachdem die Zahl dasteht');
  const seitenNach = await page.evaluate(() => window.wuerfelSpiel.seiten);
  const verboten = [String(k), String(8 - k)];
  ok(!verboten.includes(seitenNach.oben) && !verboten.includes(seitenNach.rechts),
    `Nebenseiten zeigen weder ${k} noch die Lösung ${8 - k} (oben ${seitenNach.oben}, rechts ${seitenNach.rechts})`);
  ok(await gleichung(page) === `${k}+?=8` && await sichtbar(page, '#gleichung'), `Gleichung „${k} + ? = 8“`);
  const abFrage = await abstaende(page);
  ok(gleichmaessig(abFrage), `Gleiche Abstände auch mit Lückenkasten (${abFrage.join(' / ')} px)`);
  if (bilder) await page.screenshot({ path: `${bilder}/3-frage.png` });

  const falsch = k === 4 ? 3 : k;                     // k selbst ist falsch, außer bei 4
  await page.click(`.zahl[data-zahl="${falsch}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('falsch')), 'Falsche Zahl: roter Hintergrund');
  ok(await phase(page) === 'frage', 'Falsche Zahl: Frage bleibt offen');

  const sterne = await page.evaluate(() => window.wuerfelSpiel.stand.sterne);
  await page.click(`.zahl[data-zahl="${8 - k}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('gut')), 'Richtige Zahl: grüner Hintergrund');
  ok(await page.evaluate(() => window.wuerfelSpiel.stand.sterne) === sterne + 1, 'Richtige Zahl: ein Stern mehr');
  ok(await page.evaluate(() => window.wuerfelSpiel.sterne) >= 10, 'Richtige Zahl: Sterne fliegen');
  ok(await gleichung(page) === `${k}+${8 - k}=8`, `Lösung steht da: ${k} + ${8 - k} = 8`);
  await page.waitForTimeout(450);                    // Lösung ploppt 0,35 s lang auf
  const ab = await abstaende(page);
  ok(gleichmaessig(ab), `Gleiche Abstände in der Gleichung (${ab.join(' / ')} px)`);
  await page.waitForTimeout(500);
  if (bilder) await page.screenshot({ path: `${bilder}/4-richtig.png` });

  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'bereit', null, { timeout: 4000 });
  ok(await page.evaluate(() => window.wuerfelSpiel.sterne) === 0, 'Die Sterne sind verflogen, bevor es weitergeht');
  ok(await page.textContent('#augenzahl') === '8', 'Danach zeigt der Würfel wieder die 8');
  const wuerfelSpaeter = await page.evaluate(() => document.querySelector('#wuerfel').getBoundingClientRect().top);
  ok(Math.abs(wuerfelSpaeter - wuerfelOben) < 1, `Würfel bleibt an seinem Platz (${wuerfelOben.toFixed(1)} → ${wuerfelSpaeter.toFixed(1)} px)`);
  ok(await gleichung(page) === `${k}+${8 - k}=8` && await sichtbar(page, '#gleichung'), 'Die gelöste Gleichung bleibt stehen');
  if (bilder) await page.screenshot({ path: `${bilder}/5-wieder-bereit.png` });

  await page.click('#zurueck');
  ok(await page.isVisible('#startseite'), 'Zurück-Knopf führt zur Startseite');
  ok(await page.getAttribute('#zahlwahl button[data-n="8"]', 'class') === 'zuletzt', 'Zuletzt gewählte Zahl ist markiert');

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
  const { page, konsole, ctx } = await seite(390, 844);
  for (const n of [4, 10]) {
    await page.evaluate(n => window.wuerfelSpiel.starteSpiel(n), n);
    const gezogen = [];
    let alleRichtig = true, verraten = 0;
    for (let i = 0; i <= n; i++) {
      const k = await wuerfle(page);                  // in „geloest“ startet ein Tipp sofort den nächsten Wurf
      gezogen.push(k);
      const sn = await page.evaluate(() => window.wuerfelSpiel.seiten);
      if ([sn.oben, sn.rechts].some(x => x === String(k) || x === String(n - k))) verraten++;
      await page.click(`.zahl[data-zahl="${n - k}"]`);
      if (await phase(page) !== 'geloest') alleRichtig = false;
    }
    const sortiert = [...gezogen].sort((a, b) => a - b).join(',');
    ok(alleRichtig && sortiert === Array.from({ length: n + 1 }, (_, i) => i).join(','),
      `${n}: ${n + 1} Würfe zeigen jede Zahl 0–${n} genau einmal (${gezogen.join(' ')})`);
    ok(verraten === 0, `${n}: in keinem Wurf zeigt eine sichtbare Nebenseite Wurf oder Lösung`);
    ok((await page.textContent('#hinweis')).includes('Alle Zerlegungen'), `${n}: nach der Runde „Alle Zerlegungen geschafft“`);
    await page.waitForTimeout(450);
    const ab = await abstaende(page);
    ok(gleichmaessig(ab), `${n}: gleiche Abstände in „${await gleichung(page)}“ (${ab.join(' / ')} px)`);
    const naechste = await page.evaluate(() => window.wuerfelSpiel.beutel);
    ok(naechste.length === n + 1 && naechste[naechste.length - 1] !== gezogen[n], `${n}: neue Runde beginnt nicht mit derselben Zahl`);
  }
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Auch mit „Bewegung reduzieren“ (iPhone: Bedienungshilfen → Bewegung)');
{
  const { page, ctx } = await seite(390, 844, true);
  await page.click('#zahlwahl button[data-n="6"]');
  await page.click('#wuerfel', { force: true });
  const lagen = new Set();
  while (await phase(page) === 'rollt') { lagen.add(await lage(page)); await page.waitForTimeout(40); }
  ok(lagen.size >= 10, `Der ganze Würfel dreht sich trotzdem (${lagen.size} Lagen gesehen)`);
  await ctx.close();
}

console.log('Passt aufs kleine iPhone (375 × 667)');
for (const n of [4, 7, 10]) {
  const { page, ctx } = await seite(375, 667);
  await page.click(`#zahlwahl button[data-n="${n}"]`);
  await wuerfle(page);
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
  const { page, ctx } = await seite(390, 844);
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
