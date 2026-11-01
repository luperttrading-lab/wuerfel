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
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(wurzel, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(wurzel) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': typen[path.extname(p)] || 'application/octet-stream', 'content-length': fs.statSync(p).size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

let fehler = 0;
const ok = (bed, text) => { console.log((bed ? '  ok   ' : '  FEHLER ') + text); if (!bed) fehler++; };
const browser = await pw.chromium.launch();

async function seite(breite, hoehe, ruhig = false, adresse = '?tippen', vorher = null) {   // ?tippen: Fassung mit Zahlenleiste
  const ctx = await browser.newContext({
    viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    reducedMotion: ruhig ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const konsole = [];
  page.on('pageerror', e => konsole.push(e.message));
  page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
  if (vorher) await vorher(page);
  await page.goto(url + adresse);
  return { page, konsole, ctx };
}
const phase = page => page.evaluate(() => window.wuerfelSpiel.phase);
const gleichung = async page => (await page.textContent('#gleichung')).replace(/\s/g, '');
let RUHELAGE = null;                                   // wird nach dem Start gelesen
const lage = page => page.evaluate(() => document.querySelector('#koerper').style.transform);
// Sichtbare Abstände in der Gleichung: zwischen Textkanten, beim Lückenkasten bis zu seinem Rahmen
const abstaende = async page => {
  // erst messen, wenn das Aufploppen der Lösung (0,35 s, kurz 120 %) wirklich vorbei ist – unter Last kann es nachhinken
  await page.waitForFunction(() => [...document.querySelectorAll('#gleichung *')].every(e => e.getAnimations().every(a => a.playState !== 'running')), null, { timeout: 3000 });
  return page.evaluate(() => {
  const gl = document.querySelector('#gleichung');
  const rahmen = parseFloat(getComputedStyle(gl).getPropertyValue('--rahmen')) * parseFloat(getComputedStyle(gl).fontSize);
  const r = [...gl.children].map(el => {
    if (el.classList.contains('luecke')) { const b = el.getBoundingClientRect(); return { left: b.left - rahmen, right: b.right + rahmen }; }
    const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect();
  });
  return r.slice(1).map((b, i) => +(b.left - r[i].right).toFixed(1));
  });
};
const gleichmaessig = a => Math.max(...a) - Math.min(...a) <= 1.5;
const sichtbar = (page, sel) => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).visibility === 'visible', sel);
// „Sagen“: vor dem ersten Wurf (und nach Ablauf der 2 Minuten) „Start“ bzw. „Nochmal“, sonst den Würfel
const tippe = async page => page.click(['warten', 'aus'].includes(await phase(page)) ? '#los' : '#wuerfel', { force: true });
// Versteckte Schalter: 3 s gedrückt halten (uhr: Browser-Uhr vorspulen statt warten)
async function lange(page, sel, ms = 3200, uhr = false) {
  const r = await page.locator(sel).boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  if (uhr) await page.clock.runFor(ms); else await page.waitForTimeout(ms);
  await page.mouse.up();
  if (uhr) await page.clock.runFor(100); else await page.waitForTimeout(100);
}
const tiereSchalten = (page, uhr = false) => lange(page, '#startseite h2', 3200, uhr);   // Tiere an bzw. aus
// Würfel antippen und warten, bis er liegt (rollt 2 s); force, weil Playwright sonst auf Stillstand wartet
async function wuerfle(page) {
  await tippe(page);                                   // vor dem ersten Wurf „Start“
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage', null, { timeout: 4000 });
  return page.evaluate(() => window.wuerfelSpiel.zahl);
}

// Echtzeit: läuft parallel zu allen anderen Tests volle 2 Minuten mit der echten Uhr. Gemessen wird von außen
// (Uhr von Node, nicht die der App): vom Tipp auf „Start“ bis „Die Zeit ist um!“ auf dem Bildschirm steht.
async function echtzeit() {
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  let gemeldet = null;
  await page.exposeFunction('zeitUmGemeldet', () => { gemeldet ??= performance.now(); });
  await page.click('#zahlwahl button[data-n="9"]');
  await page.evaluate(() => new MutationObserver(() => {
    if (document.querySelector('#los-text').textContent === 'Die Zeit ist um!') { window.__ende ??= Date.now(); window.zeitUmGemeldet(); }
  }).observe(document.querySelector('#los-text'), { childList: true, characterData: true, subtree: true }));
  await page.waitForTimeout(500);
  const vor = performance.now();
  await page.click('#los');
  const nach = performance.now();
  for (let i = 1; i <= 11; i++) {                         // alle 10 s ein Wurf: mit „Start“ 12 Versuche
    await new Promise(r => setTimeout(r, Math.max(0, vor + i * 10000 - performance.now())));
    await page.click('#wuerfel', { force: true });
  }
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'aus', null, { timeout: 130000 });
  const uhr = await page.evaluate(() => window.wuerfelSpiel.uhr);
  const innen = await page.evaluate(() => window.__ende - window.wuerfelSpiel.uhr.start);   // Uhr der Seite: Tipp auf „Start“ bis Anzeige
  const anzeige = await page.isVisible('#uhr') ? await page.textContent('#uhr') : '(nicht zu sehen)';
  if (bilder) { await page.waitForTimeout(1800); await page.screenshot({ path: `${bilder}/zeit-um.png` }); }
  await ctx.close();
  return { von: gemeldet - nach, bis: gemeldet - vor, innen, uhr, anzeige, konsole };
}
const echt = echtzeit();

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
  ok(await phase(page) === 'warten' && await page.isVisible('#los') && (await page.textContent('#los')) === 'Start', 'Würfel wartet, darunter „Start“');
  ok(await page.locator('#koerper .flaeche').count() === 6, 'Würfel hat sechs Seiten');
  RUHELAGE = await lage(page);
  ok(RUHELAGE.includes('rotateX(-10deg) rotateY(-12deg)') && /scale\(1(\.0+)?\)/.test(RUHELAGE), 'Ruhelage fast von vorn (10° / 12°), volle Größe');
  const ruhe = new Set(), lagen = new Set();
  for (let i = 0; i < 8; i++) { ruhe.add(await page.textContent('#augenzahl')); lagen.add(await lage(page)); await page.waitForTimeout(80); }
  ok(ruhe.size === 1 && ruhe.has('8') && lagen.size === 1 && lagen.has(RUHELAGE), 'In Ruhe liegt er still und schräg, vorne die 8');
  ok(!(await sichtbar(page, '#gleichung')) && (await page.textContent('#hinweis')) === '' && await page.locator('#stand').count() === 0,
    'Vor dem Start: keine Gleichung, kein Hinweis, kein Zähler („0/9“ gibt es nicht mehr)');
  if (bilder) await page.screenshot({ path: `${bilder}/1-bereit.png` });
  const wuerfelOben = await page.evaluate(() => document.querySelector('#wuerfel').getBoundingClientRect().top);

  const farbeVorher = await page.evaluate(() => getComputedStyle(document.querySelector('.zahl')).backgroundColor);
  await page.click('.zahl[data-zahl="4"]');
  ok(await phase(page) === 'warten' && await page.evaluate(() => document.querySelector('#los').classList.contains('stups')),
    'Zahl antippen vor dem Start zählt nicht – „Start“ wackelt');
  await page.click('#wuerfel', { force: true });
  ok(await phase(page) === 'warten', 'Würfel antippen vor dem Start: würfelt nicht');

  const t0 = Date.now();
  await page.click('#los', { force: true });          // nicht warten, bis „Start“ ausgewackelt hat
  ok(await phase(page) === 'rollt', '„Start“: Würfel rollt');
  ok(!(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt'))), 'Beim Würfeln hört der Hinweis auf');
  // Im Browser Bild für Bild mitschreiben – kurze Momente wie das Stauchen (≈ 0,1 s) entgehen sonst der Abtastung
  await page.evaluate(() => {
    const w = window.__messung = { lagen: [], staub: 0, seiten: [], zeiten: [] };
    const f = t => {
      w.zeiten.push(t);
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
  ok(kurve.ersteStauchung >= 437 && kurve.ersteStauchung <= 443, `„Bumm“ und Stauchen bei ${kurve.ersteStauchung} ms`);
  const dauer = Date.now() - t0;
  ok(kleinste < 0.8 && kleinste > 0.6, `Er wird beim Wirbeln kleiner und wieder groß (kleinste Größe ${Math.round(kleinste * 100)} %)`);
  const kante = await page.evaluate(() => document.querySelector('#koerper').offsetWidth);
  ok(verschoben < kante * 0.06, `Er bleibt dabei auf der Stelle (höchstens ${verschoben.toFixed(1)} px beim Stauchen)`);
  ok(gestaucht < 0.94, `Beim Aufprall staucht er sich (flach auf ${Math.round(gestaucht * 100)} %)`);
  ok(staubMax === 0, 'Ohne Tiere fliegt kein Staub');
  // Was der Testbrowser sieht, hängt an seiner Bildrate (ohne Bildschirm oft nur ~12 Bilder/s) – darum
  // nur: jedes Bild eine neue Lage, Nebenseiten wechseln. Die Drehung selbst wird unten genau nachgerechnet.
  ok(messung.lagen.length >= 4 && lagenRollen.size >= messung.lagen.length - 2 && wechsel >= 2,
    `Beim Rollen überschlägt er sich (${lagenRollen.size} Lagen in ${messung.lagen.length} Bildern) und die Zahlen wechseln (${wechsel}×)`);
  const drehung = await page.evaluate(() => {
    // Vorderseite Bild für Bild (1 ms) nachgerechnet – mit derselben Drehformel wie die App
    let verdeckt = 0, vorn = null, letzteVerdeckt = null, schnellste = 0, vorher = null;
    for (let ms = 0; ms <= ROLLZEIT; ms++) {
      const p = ms / ROLLZEIT, f = 1 - (1 - p) ** 2, ax = RUHE.x + DREH.x * f, ay = RUHE.y + DREH.y * f;
      const z = drehe(NORMALE.vorne, ax, ay)[2];
      if (p > 0.4 && z < 0.15) { verdeckt++; letzteVerdeckt = ms; }   // so schreibt die App die Zahl auf
      if (letzteVerdeckt !== null && ms > letzteVerdeckt && z > 0.9 && vorn === null) vorn = ms;
      if (vorher !== null) schnellste = Math.max(schnellste, Math.abs(ax - vorher) * 1000 / 60);
      vorher = ax;
    }
    return { verdeckt, vorn, aufprall: AUFPRALL * ROLLZEIT, schnellste, ueberschlaege: DREH.x / 360 };
  });
  ok(drehung.verdeckt >= 100 && drehung.vorn !== null && drehung.vorn <= drehung.aufprall,
    `Gewürfelte Zahl kommt hochkant/verdeckt auf die Vorderseite (Fenster ${drehung.verdeckt} ms – auch bei 12 Bildern/s sicher), vorn ab ${drehung.vorn} ms, vor dem „Bumm“ (${drehung.aufprall} ms)`);
  ok(drehung.ueberschlaege >= 2 && drehung.schnellste <= 55,
    `${drehung.ueberschlaege} Überschläge, höchstens ${drehung.schnellste.toFixed(0)}° pro Bild bei 60 Bildern/s (ab ~60° flimmert es)`);
  // Bei flüssiger Darstellung genau 0,5 s. Ruckelt es (hier im Testbrowser oft), rückt die Animation pro Bild
  // höchstens 40 ms vor und dauert um die Aussetzer länger – das wird aus den gemessenen Bildabständen nachgerechnet.
  const zeiten = messung.zeiten, verlaengerung = zeiten.slice(1).reduce((s, t, i) => s + Math.max(0, t - zeiten[i] - 40), 0);
  ok(dauer >= 450 && dauer <= 500 + verlaengerung + 450,
    `Rollen dauert ${dauer} ms (Soll 0,5 s + ${Math.round(verlaengerung)} ms Verlängerung durch Ruckler des Testbrowsers)`);
  let k = await page.evaluate(() => window.wuerfelSpiel.zahl);
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

  // Lesbarkeit der Antworttasten: Kontrast Schrift/Taste nach WCAG
  const kontrast = await page.evaluate(() => {
    const rgb = c => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const hell = ([r, g, b]) => [r, g, b].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; })
      .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
    const verh = (a, b) => { const [h, d] = [hell(a), hell(b)].sort((x, y) => y - x); return (h + 0.05) / (d + 0.05); };
    const z = getComputedStyle(document.querySelector('.zahl'));
    return verh(rgb(z.color), rgb(z.backgroundColor));
  });
  ok(kontrast >= 4.5, `Antworttasten gut lesbar (Kontrast ${kontrast.toFixed(1)} : 1, Mindestmaß 4,5)`);
  const farbeFrage = await page.evaluate(() => getComputedStyle(document.querySelector('.zahl')).backgroundColor);
  ok(farbeVorher === farbeFrage, `Tasten sehen vor dem Würfeln genauso kräftig aus wie bei der Frage (${farbeFrage})`);
  // Lupe: Finger aufsetzen, seitlich rutschen – die Lupe folgt; es zählt die Taste beim Loslassen
  const mitte = async z => page.evaluate(z => { const r = document.querySelector(`.zahl[data-zahl="${z}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, z);
  const [x0, y0] = await mitte(0), [x1] = await mitte(1);
  await page.mouse.move(x0, y0); await page.mouse.down();
  const lupe1 = await page.evaluate(() => !document.querySelector('#lupe').hidden && document.querySelector('#lupe').textContent);
  await page.mouse.move(x1, y0, { steps: 3 });
  const lupe2 = await page.evaluate(() => document.querySelector('#lupe').textContent);
  ok(lupe1 === '0' && lupe2 === '1', `Lupe zeigt die getroffene Zahl und folgt dem Finger (${lupe1} → ${lupe2})`);
  await page.mouse.move(x1, y0 - 400); await page.mouse.move(x0, y0 - 400);   // ganz woanders hin …
  await page.mouse.move(x0, y0);                                               // … und zurück auf die 0
  await page.mouse.up();
  const nachLupe = await page.evaluate(() => [window.wuerfelSpiel.phase, document.body.className, document.querySelector('#lupe').hidden]);
  ok(nachLupe[2] && (nachLupe[0] === 'geloest' ? 8 - k === 0 : nachLupe[1].includes('falsch') || 8 - k === 0),
    'Beim Loslassen zählt die Taste unter dem Finger, die Lupe verschwindet');
  if (nachLupe[0] === 'geloest') { await page.waitForFunction(() => window.wuerfelSpiel.phase === 'bereit', null, { timeout: 4000 }); k = await wuerfle(page); }
  const falsch = k === 4 ? 3 : k;                     // k selbst ist falsch, außer bei 4
  await page.click(`.zahl[data-zahl="${falsch}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('falsch')), 'Falsche Zahl: roter Hintergrund');
  ok(await phase(page) === 'frage', 'Falsche Zahl: Frage bleibt offen');

  const sterne = await page.evaluate(() => window.wuerfelSpiel.stand.sterne);
  await page.click(`.zahl[data-zahl="${8 - k}"]`);
  ok(await page.evaluate(() => document.body.classList.contains('gut')), 'Richtige Zahl: grüner Hintergrund');
  ok(await page.evaluate(() => window.wuerfelSpiel.stand.sterne) === sterne + 1, 'Richtige Zahl: ein Stern mehr');
  ok(!(await page.textContent('#spielseite .kopf')).includes('⭐') && !(await page.textContent('#startseite .kopf')).includes('⭐'),
    'Kein Punktestand in den Kopfzeilen (zählt nur still mit)');
  ok(await page.evaluate(() => window.wuerfelSpiel.sterne) >= 55, 'Richtige Zahl: 60 Sterne fliegen');
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
  // Leiser Hinweis: erst nach 2 s beginnt „Tippe auf den Würfel!“ die Farbe zu wechseln
  ok((await page.textContent('#hinweis')) === 'Tippe auf den Würfel!' && !(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt'))),
    'Danach „Tippe auf den Würfel!“, anfangs ruhig');
  await page.waitForTimeout(2200);
  const farben = new Set();
  for (let i = 0; i < 6; i++) { farben.add(await page.evaluate(() => getComputedStyle(document.querySelector('#hinweis')).color)); await page.waitForTimeout(150); }
  ok(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt')) && farben.size >= 3,
    `Nach 2 s wechselt der Hinweis sanft die Farbe (${farben.size} Farbtöne gesehen)`);
  await page.click('.zahl[data-zahl="4"]');
  ok(await phase(page) === 'bereit' && (await page.textContent('#hinweis')).includes('Erst würfeln'), 'Zahl antippen vor dem nächsten Wurf zählt nicht – „Erst würfeln!“');

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

console.log('Tiere (versteckt: 3 s auf die Überschrift der Startseite)');
{
  const { page, konsole, ctx } = await seite(390, 844);
  const geladen = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].every(i => i.complete && i.naturalWidth > 0 && i.offsetWidth > 0), sel);
  ok(await page.isHidden('#tiere-schalter') && await page.isHidden('#staub-schalter') && await page.isHidden('#zahlwahl img'),
    'Beim Laden: ohne Tiere, weder 🐾 noch 💨 zu sehen');
  await page.click('#zahlwahl button[data-n="7"]');
  ok(await page.isHidden('#tier'), 'Beim Laden: kein Tier und keine Zahl über dem Würfel');
  await page.click('#zurueck');
  const quellen = () => page.evaluate(() => [...document.querySelectorAll('#zahlwahl img')].map(i => i.getAttribute('src')));
  await lange(page, '#startseite h2', 1200);
  ok(await page.isHidden('#tiere-schalter') && await page.isHidden('#zahlwahl img'), 'Kurz drücken (1,2 s): bleibt ohne Tiere');
  await tiereSchalten(page);
  ok(await page.isVisible('#tiere-schalter') && await page.getAttribute('#tiere-schalter', 'data-satz') === 'sticker'
    && (await page.textContent('#update-text')) === 'Tiere: Sticker', '3 s auf „Welche Zahl zerlegen wir?“: Sticker-Tiere an, 🐾 erscheint');
  await page.waitForTimeout(300);
  ok(await geladen('#zahlwahl img') && (await quellen()).every((q, i) => q === `tiere/${i + 4}.webp`), 'Startseite: auf jeder Zahlentaste sitzt ihr Sticker');
  await page.click('#zahlwahl button[data-n="7"]');
  await page.waitForTimeout(300);
  const tier = await page.evaluate(() => ({ alt: document.querySelector('#tier-bild').alt, zahl: document.querySelector('#tier-zahl').textContent,
    sichtbar: !document.querySelector('#tier').hidden }));
  ok(tier.sichtbar && tier.alt === 'Seestern' && tier.zahl === '7' && await geladen('#tier-bild'), 'Spielseite: Seestern mit der 7 über dem Würfel');
  for (const [w, satz] of [[320, 'sticker'], [390, 'sticker'], [320, 'wild'], [390, 'wild']]) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.evaluate(satz => { window.wuerfelSpiel.stand.tiere = satz; }, satz);
    const zugedeckt = [];
    for (const n of [4, 5, 6, 7, 8, 9, 10]) {
      await page.evaluate(n => window.wuerfelSpiel.starteSpiel(n), n);
      await page.waitForFunction(() => { const i = document.querySelector('#tier-bild'); return i.complete && i.naturalWidth > 0; });
      const verdeckt = await page.evaluate(() => {
        const img = document.querySelector('#tier-bild'), t = img.getBoundingClientRect(), z = document.querySelector('#tier-zahl').getBoundingClientRect();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const k = img.naturalWidth / t.width;        // Bildpunkte je CSS-Pixel
        const x0 = Math.max(0, Math.floor((z.left - t.left) * k)), x1 = Math.min(c.width, Math.ceil((z.right - t.left) * k));
        const y0 = Math.max(0, Math.floor((z.top - t.top) * k)), y1 = Math.min(c.height, Math.ceil((z.bottom - t.top) * k));
        if (x1 <= x0 || y1 <= y0) return 0;
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
        return n;
      });
      if (verdeckt) zugedeckt.push(`${n}: ${verdeckt} Bildpunkte`);
      const rechts = await page.evaluate(() => document.querySelector('#tier-zahl').getBoundingClientRect().right);
      if (rechts > w) zugedeckt.push(`${n}: Plakette ragt aus dem Bild (${Math.round(rechts)} px)`);
    }
    ok(!zugedeckt.length, `${w} px, ${satz}: Zahlplakette verdeckt bei keinem der 7 Tiere etwas und bleibt im Bild` + (zugedeckt.length ? ' – ' + zugedeckt.join(', ') : ''));
  }
  await page.evaluate(() => { window.wuerfelSpiel.stand.tiere = 'sticker'; window.wuerfelSpiel.starteSpiel(7); });
  // „Zahl antippen“ hält unter dem Würfel Platz für „Start“ und Uhr frei: auf kleinen iPhones wird das Tier kleiner
  for (const [w, h, min] of [[320, 568, 70], [375, 667, 150], [390, 844, 235], [430, 932, 260]]) {
    await page.setViewportSize({ width: w, height: h });
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      let wuerfel = 1e9; for (const f of document.querySelectorAll('#koerper > *')) { const q = f.getBoundingClientRect(); if (q.width) wuerfel = Math.min(wuerfel, q.top); }
      return { groesse: r('#tier-bild').height, oben: r('#tier-bild').top, unten: r('#tier-bild').bottom, kopf: r('#spielseite .kopf').bottom, wuerfel };
    });
    ok(m.groesse >= min && m.oben >= m.kopf && m.unten <= m.wuerfel,
      `${w}×${h}: Tier groß (${Math.round(m.groesse)} px hoch), zwischen Kopfzeile und ruhendem Würfel`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const k = await wuerfle(page);
  await page.click(`.zahl[data-zahl="${7 - k}"]`);
  ok(await page.evaluate(() => document.querySelector('#tier').classList.contains('hops')), 'Richtige Antwort: das Tier hüpft vor Freude');
  await page.click('#zurueck');
  await page.click('#tiere-schalter');
  await page.waitForTimeout(300);
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild' && await geladen('#zahlwahl img')
    && (await quellen()).every((q, i) => q === `tiere/wild/${i + 4}.webp`), '🐾 antippen: wilde Tiere auf den Starttasten');
  const pille = await page.evaluate(() => {
    const p = document.querySelector('#update').getBoundingClientRect(), k = document.querySelector('#startseite .kopf').getBoundingClientRect();
    return { breite: p.width, mitte: p.left + p.width / 2, oben: p.top, kopf: k.bottom, text: document.querySelector('#update-text').textContent,
      tatzen: getComputedStyle(document.querySelector('#tiere-schalter')).backgroundImage };
  });
  ok(pille.text === 'Tiere: wild & bunt' && pille.breite < 390 * .6 && Math.abs(pille.mitte - 195) < 2 && pille.oben >= pille.kopf,
    `Hinweis als kleine Pille mittig unter der Kopfzeile (${Math.round(pille.breite)} px breit)`);
  ok(pille.tatzen.includes('linear-gradient'), 'Wilde Tiere: Tatzen mit buntem Hintergrund');
  await page.click('#zahlwahl button[data-n="7"]');
  await page.waitForTimeout(300);
  ok(await page.getAttribute('#tier-bild', 'src') === 'tiere/wild/7.webp' && await geladen('#tier-bild'), 'Spielseite: der wilde Seestern über dem Würfel');
  await page.click('#zurueck');
  await page.click('#tiere-schalter'); await page.click('#tiere-schalter');
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild', '🐾 zweimal schnell: Sticker und zurück zu wild (Hinweis fängt keine Tipps ab)');
  await page.reload();
  ok(await page.isHidden('#tiere-schalter') && await page.isHidden('#zahlwahl img'), 'Neu geladen: wieder ohne Tiere');
  await lange(page, '#startseite h1');
  ok(await page.isVisible('#tiere-schalter') && await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild',
    '3 s auf „Würfel“: Tiere an, der zuletzt gewählte Satz (wild) ist gemerkt');
  await tiereSchalten(page);
  ok(await page.isHidden('#tiere-schalter') && await page.isHidden('#zahlwahl img') && (await page.textContent('#update-text')) === 'Ohne Tiere',
    'Noch einmal 3 s: Tiere aus, 🐾 wieder versteckt');
  await page.click('#zahlwahl button[data-n="7"]');
  ok(await page.isHidden('#tier'), 'Ohne Tiere: nichts über dem Würfel');
  await page.click('#zurueck');
  await lange(page, '#version');
  ok(await page.isHidden('#tiere-schalter'), '3 s auf die Versionsnummer: keine Tiere (sie bleibt der Update-Knopf)');
  await page.evaluate(() => localStorage.setItem('wuerfel.stand', JSON.stringify({ n: 7, tiere: 'wild' })));
  await page.reload();
  ok(await page.isHidden('#tiere-schalter') && await page.isHidden('#zahlwahl img'), 'Bis v0.42 gespeichert „Tiere an“: beim Laden trotzdem aus');
  await tiereSchalten(page);
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild', '… beim Einschalten kommt der damals gewählte Satz (wild)');
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Hilfe: 3 s auf ⓘ erklärt die geheimen Schalter');
{
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  ok(await page.isVisible('#info-knopf') && await page.isHidden('#hilfe'), 'ⓘ oben auf der Startseite, Hilfe zu');
  await page.click('#info-knopf');
  ok(await page.isHidden('#hilfe') && (await page.textContent('#update-text')) === 'Für Erwachsene: 3 Sekunden drücken', 'Kurz tippen: Hilfe bleibt zu, nur der Hinweis „3 Sekunden drücken“');
  await page.waitForTimeout(2300);
  await lange(page, '#info-knopf', 1200);
  ok(await page.isHidden('#hilfe'), '1,2 s drücken: Hilfe bleibt zu');
  await lange(page, '#info-knopf');
  const titel = await page.evaluate(() => [...document.querySelectorAll('#hilfe h3')].map(h => h.firstChild.textContent.trim()));
  ok(await page.isVisible('#hilfe') && ['Tiere an / aus', 'Uhr an / aus', 'Versuche am Ende an / aus', 'Zeitlinie oben', 'Diese Hilfe und Updates', 'Nur Würfel oder mit Zahlen unten', 'Sprechen an / aus', 'Sprechtest'].every(t => titel.includes(t))
    && !(await page.textContent('#hilfe')).includes('Safari'),
    `3 s drücken: Hilfe offen (${titel.length} Punkte: ${titel.join(' · ')})`);
  ok(await page.evaluate(() => document.querySelectorAll('#hilfe .mini').length === 8 && document.querySelectorAll('#hilfe .mini .ziel').length >= 8),
    'Zu jedem Schalter ein Mini-Bildschirm mit Ring, wo man drückt');
  ok((await page.textContent('#jetzt-tiere')) === 'jetzt aus' && (await page.textContent('#jetzt-ende')) === 'jetzt an' && (await page.textContent('#jetzt-fassung')) === 'jetzt: nur Würfel' && (await page.textContent('#jetzt-sprechen')) === 'jetzt aus'
    && (await page.textContent('#mini-version')) === (await page.textContent('#version')),
    'Zeigt, was gerade eingestellt ist (Tiere aus, Versuche am Ende an, nur Würfel, Sprechen aus) und die echte Versionsnummer');
  ok(await page.isHidden('#tiere-schalter') && !(await page.evaluate(() => document.querySelector('#update').classList.contains('an'))),
    'Langes Drücken auf ⓘ schaltet keine Tiere und zeigt keinen Tipp-Hinweis');
  ok(await page.getAttribute('#hilfe a.hilfe-link', 'href') === 'sprechtest.html', 'Hilfe verlinkt den Sprechtest');
  await page.click('#hilfe-zu');
  ok(await page.isHidden('#hilfe'), '✕ schließt');
  await lange(page, '#info-knopf');
  await page.mouse.click(195, 4);
  ok(await page.isHidden('#hilfe'), 'Daneben tippen schließt');
  await lange(page, '#info-knopf');
  await page.keyboard.press('Escape');
  ok(await page.isHidden('#hilfe'), 'Esc schließt');
  await page.setViewportSize({ width: 320, height: 568 });
  await lange(page, '#info-knopf');
  const m = await page.evaluate(() => { const k = document.querySelector('.hilfe-karte').getBoundingClientRect(), i = document.querySelector('.hilfe-inhalt');
    const vorher = i.scrollHeight > i.clientHeight; i.scrollTop = i.scrollHeight;
    const letzte = [...i.querySelectorAll('.geheim')].at(-1).getBoundingClientRect();
    return { oben: k.top, unten: k.bottom, scrollt: vorher && i.scrollTop > 0, letzte: letzte.bottom <= k.bottom + 1, breit: document.scrollingElement.scrollWidth <= innerWidth }; });
  ok(m.oben >= 0 && m.unten <= 568 && m.scrollt && m.letzte && m.breit, '320×568: Fenster passt auf den Bildschirm, der Inhalt lässt sich bis zum Ende scrollen');
  if (bilder) await page.screenshot({ path: `${bilder}/hilfe-320.png` });
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Sprechtest-Seite (ohne Mikrofon; die Erkennung prüft tests/sprechtest.mjs)');
{
  const { page, konsole, ctx } = await seite(390, 844, false, 'sprechtest.html');
  ok(await page.evaluate(() => typeof Vosk === 'object' && typeof Vosk.createModel === 'function') && (await page.textContent('#los')) === 'Sprachmodell laden',
    'Lädt die Erkennung (sprache/vosk.js), Knopf „Sprachmodell laden“');
  ok(await page.evaluate(() => [window.sprechtest.zahlAus('[unk] fünf'), window.sprechtest.zahlAus('zwo'), window.sprechtest.zahlAus('hallo')].join()) === '5,2,',
    'Zahlwörter: „ähm fünf“ → 5, „zwo“ → 2, anderes → nichts');
  const modell = await page.evaluate(async () => (await fetch('sprache/vosk-model-small-de-0.15.tar.gz', { method: 'HEAD' })).headers.get('content-length'));
  ok(+modell > 40e6 && +modell < 50e6, `Sprachmodell liegt bereit (${(modell / 1e6).toFixed(1)} MB)`);
  ok(await page.getAttribute('.zurueck', 'href') === './', '‹ führt zurück zum Würfel');
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Sprechen an/aus: 3 s auf 🔊 (ohne Mikrofon; mit Ersatz-Mikrofon prüft es tests/sprechtest.mjs)');
{
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  const ton = () => page.evaluate(() => window.wuerfelSpiel.stand.ton);
  const mikro = () => page.evaluate(() => document.querySelector('#startseite .ton').classList.contains('mikro'));
  await page.click('#startseite .ton');
  ok(!(await ton()) && !(await mikro()), 'Kurz tippen: nur Ton aus, Sprechen bleibt aus');
  await page.click('#startseite .ton');
  await lange(page, '#startseite .ton');
  ok(await ton() && await mikro() && await page.evaluate(() => window.wuerfelSpiel.stand.sprechen) && (await page.textContent('#update-text')).startsWith('Sprechen an'),
    '3 s auf 🔊: „Sprechen an“, kleines 🎤 am Knopf, der Ton bleibt an');
  await page.waitForFunction(() => window.wuerfelSpiel.sprache.bereit, null, { timeout: 60000 });
  ok((await page.textContent('#update-text')) === 'Sprechen an – ab „Start“ hört die App zu', 'Sprachmodell geladen: „ab „Start“ hört die App zu“');
  await page.reload();
  ok(await mikro() && await page.evaluate(() => window.wuerfelSpiel.stand.sprechen), 'Bleibt nach dem Neuladen an');
  await page.click('#zahlwahl button[data-n="6"]');
  ok(await page.evaluate(() => document.querySelector('#spielseite .ton').classList.contains('mikro')), 'Auch auf der Spielseite das 🎤 am 🔊');
  await page.click('#los');                              // ohne Mikrofon im Testbrowser: Hinweis, das Spiel läuft trotzdem
  await page.waitForFunction(() => document.querySelector('#update-text').textContent.startsWith('Sprechen geht') || document.querySelector('#update-text').textContent.startsWith('Mikrofon'), null, { timeout: 10000 });
  ok(await page.evaluate(() => window.wuerfelSpiel.uhr.laeuft) && !(await page.evaluate(() => window.wuerfelSpiel.sprache.hoert)),
    `Kein Mikrofon da: „${await page.textContent('#update-text')}“, die 2 Minuten laufen trotzdem`);
  await page.click('#zurueck');
  await lange(page, '#startseite .ton');
  ok(!(await mikro()) && (await page.textContent('#update-text')) === 'Sprechen aus', 'Noch einmal 3 s: „Sprechen aus“');
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Sagen (Standard): nur würfeln, die Antwort laut sagen');
{
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  ok(await page.evaluate(() => document.body.classList.contains('sagen')), 'Ohne ?tippen: Sagen-Fassung');
  await page.click('#zahlwahl button[data-n="4"]');
  await page.waitForTimeout(300);
  ok(await page.isHidden('#zahlen') && await page.isHidden('#gleichung') && await page.isHidden('#hinweis') && await page.locator('#stand').count() === 0,
    'Nur der Würfel: keine Zahlenleiste, keine Gleichung, kein Text darunter, kein Zähler');
  ok(await page.isHidden('#tier'), 'Ohne Tiere: nichts über dem Würfel');
  ok(await page.isVisible('#los') && (await page.textContent('#los')) === 'Start' && (await page.textContent('#los-text')) === 'Bereit?',
    'Unter dem Würfel: „Bereit?“ und der Knopf „Start“');
  await page.click('#wuerfel', { force: true }); await page.waitForTimeout(300);
  ok(await phase(page) === 'warten', 'Vor dem Start würfelt der Würfel nicht (er wackelt nur)');
  const gesehen = [];
  for (let i = 0; i < 25; i++) {
    await tippe(page);
    await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage', null, { timeout: 5000 });
    const k = await page.evaluate(() => window.wuerfelSpiel.zahl);
    if (await page.textContent('#augenzahl') !== String(k)) gesehen.push('FALSCH');
    gesehen.push(k);
  }
  ok(gesehen.every(k => Number.isInteger(k) && k >= 0 && k <= 4), `„Start“ würfelt, danach würfelt Antippen immer weiter, Würfel zeigt 0 … 4 (${gesehen.join(' ')})`);
  ok(await page.evaluate(() => window.wuerfelSpiel.umgesprungen) === 0, 'Die Zahl ist bei keinem der 25 Würfe sichtbar umgesprungen');
  ok(await page.isHidden('#los') && await page.isHidden('#uhr'), 'Während der 2 Minuten: kein Knopf, keine Uhr zu sehen');
  // Echter Würfel: gleichverteilt und ohne Gedächtnis – Doppelte kommen so oft vor wie beim echten Würfeln
  const wurf = await page.evaluate(() => {
    const N = 60000, m = 5, h = new Array(m).fill(0), paar = new Array(m * m).fill(0); let doppelt = 0, vorher = null;
    window.wuerfelSpiel.stand.n = 4;
    for (let i = 0; i < N; i++) {
      const k = window.wuerfelSpiel.wurfZiel(); h[k]++;
      if (vorher !== null) { paar[vorher * m + k]++; if (k === vorher) doppelt++; }
      vorher = k;
    }
    const chi = (o, e) => o.reduce((s, x) => s + (x - e) ** 2 / e, 0);
    return { chi1: chi(h, N / m), chi2: chi(paar, (N - 1) / (m * m)), doppelt: doppelt / (N - 1) };
  });
  ok(wurf.chi1 < 18.467, `Jede Zahl gleich wahrscheinlich: χ² = ${wurf.chi1.toFixed(1)} < 18.467 (df 4, α = 0,001)`);
  ok(wurf.chi2 < 51.179, `Unabhängig vom vorigen Wurf (Paare): χ² = ${wurf.chi2.toFixed(1)} < 51.179 (df 24, α = 0,001)`);
  ok(Math.abs(wurf.doppelt - 0.2) < 0.015, `Doppelte hintereinander wie beim echten Würfel: ${(wurf.doppelt * 100).toFixed(1)} % (Soll 1/5 = 20 %)`);
  await page.click('#zurueck');
  await tiereSchalten(page);
  await page.click('#zahlwahl button[data-n="8"]');
  await page.waitForTimeout(300);
  ok(await page.isVisible('#tier-bild'), 'Tiere an: das Tier über dem Würfel');
  for (const [w, h] of [[320, 568], [375, 667]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1), `${w}×${h}: passt ohne Scrollen`);
  }
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Staub: nur mit Tieren, dann bunt oder aus (💨)');
{
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  ok(await page.isHidden('#staub-schalter'), 'Ohne Tiere: kein 💨-Schalter');
  const farbenBeimRollen = async () => {
    await page.click('#zahlwahl button[data-n="6"]');
    await page.waitForTimeout(300);
    await tippe(page);
    await page.waitForTimeout(220);                       // mitten im Wirbeln, viel Staub in der Luft
    const m = await page.evaluate(() => {
      const c = document.querySelector('#staub'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const toene = new Set(); let koerner = 0;
      for (let i = 0; i < d.length; i += 4 * 7) {
        if (d[i + 3] < 60) continue;
        koerner++;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx - mn < .15) continue;                       // grau/braun zählt nicht als bunt
        let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
        toene.add(Math.floor(((h * 60 + 360) % 360) / 60));   // sechs Farbbereiche à 60°
      }
      return { koerner, toene: toene.size, anzahl: window.wuerfelSpiel.staub };
    });
    await page.waitForFunction(() => window.wuerfelSpiel.phase === 'frage', null, { timeout: 5000 });
    await page.waitForTimeout(900);                        // Aufprallwölkchen verweht
    await page.click('#zurueck');
    return m;
  };
  const ohne = await farbenBeimRollen();
  ok(ohne.anzahl === 0 && ohne.koerner === 0, 'Ohne Tiere: kein einziges Korn beim Würfeln (auch beim Aufprall nicht)');
  await tiereSchalten(page);
  ok(await page.isVisible('#staub-schalter') && await page.getAttribute('#staub-schalter', 'aria-pressed') === 'true', 'Mit Tieren: 💨 da und an');
  const an = await farbenBeimRollen();
  ok(an.anzahl >= 150 && an.toene >= 4, `Mit Tieren: viel bunter Staub (${an.anzahl} Körner gleichzeitig, ${an.toene} von 6 Farbbereichen)`);
  await page.click('#staub-schalter');
  ok(await page.getAttribute('#staub-schalter', 'aria-pressed') === 'false', '💨 antippen: Staub aus');
  const aus = await farbenBeimRollen();
  ok(aus.anzahl === 0 && aus.koerner === 0, 'Mit Tieren, 💨 aus: kein einziges Korn');
  await page.reload();
  ok(await page.isHidden('#staub-schalter'), 'Neu geladen: Tiere aus, also auch kein 💨');
  await tiereSchalten(page);
  ok(await page.isVisible('#staub-schalter') && await page.getAttribute('#staub-schalter', 'aria-pressed') === 'false', 'Tiere wieder an: 💨 bleibt aus, wie gewählt');
  await page.setViewportSize({ width: 320, height: 568 });
  ok(await page.evaluate(() => { const k = document.querySelector('#startseite .kopf'); return k.scrollWidth <= k.clientWidth + 1 && document.scrollingElement.scrollWidth <= innerWidth; }),
    '320 px: Kopfzeile mit ⓘ und drei Knöpfen passt');
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Start und genau 2 Minuten (Uhr des Browsers vorgespult)');
{
  // Playwright ersetzt Date, setTimeout, setInterval und requestAnimationFrame: die Zeit läuft nur, wenn der Test sie
  // vorspult (runFor) – so lässt sich jede Millisekunde prüfen, ohne 2 Minuten zu warten.
  const T0 = new Date('2026-10-17T10:00:00Z').getTime();
  const { page, konsole, ctx } = await seite(390, 844, false, '', p => p.clock.install({ time: T0 }));
  await page.clock.pauseAt(T0 + 5000);
  const uhr = () => page.evaluate(() => window.wuerfelSpiel.uhr);
  const halten = async (sel, ms) => {
    const r = await page.locator(sel).boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
    await page.clock.runFor(ms); await page.mouse.up(); await page.clock.runFor(100);
  };
  const lageWuerfel = () => page.evaluate(() => Math.round(document.querySelector('#wuerfel').getBoundingClientRect().top));
  await page.click('#zahlwahl button[data-n="9"]');
  await page.clock.runFor(300);
  await halten('#spielseite .titel', 1200);
  ok(await page.isHidden('#uhr'), 'Kurz drücken (1,2 s): keine Uhr');
  const ohneUhr = await lageWuerfel();
  await halten('#spielseite .titel', 3200);
  ok(await page.isVisible('#uhr') && (await page.textContent('#uhr')) === '0:00,0 · 0 Versuche', '3 s auf „Zerlegen: 9“ drücken: Uhr erscheint („0:00,0 · 0 Versuche“)');
  ok(await lageWuerfel() === ohneUhr, `Uhr ein- und ausblenden verschiebt nichts (Würfel bleibt bei ${ohneUhr} px)`);
  const schrift = await page.evaluate(() => getComputedStyle(document.querySelector('#uhr')).fontFamily);
  ok(!/mono|Menlo/i.test(schrift) && schrift.includes('ui-rounded'), `Uhr in der Schrift der App, nicht Schreibmaschine (${schrift.split(',')[0]})`);
  const linie = () => page.evaluate(() => { const r = document.querySelector('#fortschritt').getBoundingClientRect(), c = getComputedStyle(document.querySelector('#fortschritt'));
    return { breite: Math.round(r.width), oben: r.top, hoch: r.height, farbe: c.backgroundColor }; });
  const l0 = await linie();
  ok(l0.breite === 0, 'Vor dem Start: keine Linie');
  const vorStart = await lageWuerfel();
  await page.click('#wuerfel', { force: true }); await page.clock.runFor(1000);
  ok(await phase(page) === 'warten' && (await uhr()).versuche === 0 && (await page.textContent('#uhr')) === '0:00,0 · 0 Versuche',
    'Würfel vor dem Start antippen: nichts läuft, die Uhr steht');
  const start = await page.evaluate(() => Date.now());
  await page.click('#los');
  ok((await uhr()).start === start && (await uhr()).versuche === 1 && await phase(page) === 'rollt', '„Start“: die Uhr läuft ab diesem Moment, der erste Wurf rollt schon (1 Versuch)');
  await page.clock.runFor(1000);
  ok(await page.isHidden('#los') && await lageWuerfel() === vorStart, 'Knopf weg, der Würfel bleibt, wo er war (nichts springt)');
  await page.clock.runFor(59000);
  const l1 = await linie();
  ok(Math.abs(l1.breite - 195) <= 1 && l1.oben === 0 && l1.hoch === 3 && l1.farbe === 'rgb(43, 90, 152)',
    `Nach 1 Minute: Linie oben halb über den Bildschirm (${l1.breite} von 390 px, ${l1.hoch} px dick, Farbe der Statusleiste ${l1.farbe})`);
  let wuerfe = 1;
  while ((await uhr()).vergangen + 5000 < 119000) { await page.click('#wuerfel', { force: true }); wuerfe++; await page.clock.runFor(5000); }
  await page.clock.runFor(119000 - (await uhr()).vergangen);
  await page.click('#wuerfel', { force: true }); wuerfe++;          // Wurf bei 1:59,0
  await page.clock.runFor(119999 - (await uhr()).vergangen);
  const kurzVor = await uhr();
  ok(kurzVor.laeuft && kurzVor.vergangen === 119999 && await phase(page) === 'frage' && (await page.textContent('#uhr')) === `1:59,9 · ${wuerfe} Versuche`,
    `Bei 119 999 ms läuft sie noch („1:59,9 · ${wuerfe} Versuche“)`);
  await page.clock.runFor(1);
  const um = await uhr();
  ok(!um.laeuft && um.um && await phase(page) === 'aus' && await page.evaluate(() => Date.now()) - start === 120000,
    'Bei genau 120 000 ms ist Schluss');
  ok((await page.textContent('#los-text')) === 'Die Zeit ist um!' && (await page.textContent('#los')) === 'Nochmal' && await page.isVisible('#los'),
    'Dann: „Die Zeit ist um!“ und „Nochmal“');
  ok((await page.textContent('#uhr')) === `2:00,0 · ${wuerfe} Versuche` && um.versuche === wuerfe, `Uhr: „2:00,0 · ${wuerfe} Versuche“ – jeder Wurf gezählt`);
  ok((await linie()).breite === 390, 'Nach 2 Minuten: Linie über die ganze Breite');
  await page.click('#wuerfel', { force: true }); await page.clock.runFor(1000);
  ok(await phase(page) === 'aus' && (await uhr()).versuche === wuerfe, 'Danach würfelt der Würfel nicht mehr');
  await halten('#spielseite .titel', 3200);                         // Uhr aus
  ok(await page.isVisible('#uhr') && (await page.textContent('#uhr')) === `2:00,0 · ${wuerfe} Versuche`, 'Uhr aus: am Ende stehen Zeit und Versuche trotzdem da');
  await halten('#los-text', 3200);
  ok(await page.isHidden('#uhr') && (await page.textContent('#update-text')) === 'Versuche am Ende: aus'
    && await page.evaluate(() => JSON.parse(localStorage.getItem('wuerfel.stand')).ende === false), '3 s auf „Die Zeit ist um!“: am Ende keine Anzeige mehr (gespeichert)');
  await halten('#los-text', 3200);
  ok(await page.isVisible('#uhr') && (await page.textContent('#update-text')) === 'Versuche am Ende: an', 'Noch einmal 3 s: wieder an');
  const hinweisDa = () => page.evaluate(() => document.querySelector('#update').classList.contains('an'));
  await halten('#los', 3200);
  ok(await phase(page) === 'aus' && (await uhr()).versuche === wuerfe && await page.isHidden('#uhr') && (await page.textContent('#update-text')) === 'Versuche am Ende: aus',
    '3 s auf „Nochmal“: schaltet genauso um und startet keine neue Runde');
  await page.clock.runFor(3000);
  const nochDa = await hinweisDa();
  await page.clock.runFor(1000);
  ok(nochDa && !(await hinweisDa()), 'Der Hinweis steht 3,6 s (nach 3,3 s noch da, nach 4,3 s weg)');
  await halten('#los', 1500);
  ok(await phase(page) === 'aus' && await page.isHidden('#uhr'), '1,5 s auf „Nochmal“: weder neue Runde noch Umschalten');
  await halten('#los', 3200);
  ok(await phase(page) === 'aus' && await page.isVisible('#uhr'), 'Noch einmal 3 s auf „Nochmal“: Anzeige wieder an, immer noch keine neue Runde');
  await halten('#spielseite .titel', 3200);                         // Uhr wieder an
  // Rollt er, wenn die Zeit um ist: er landet noch, dann kommt der Schluss
  await page.click('#los');
  ok((await uhr()).versuche === 1 && (await page.textContent('#uhr')).startsWith('0:00,0 · 1 Versuch'), '„Nochmal“: neue 2 Minuten, Zähler von vorn (1 Versuch)');
  await page.clock.runFor(119800);
  await page.click('#wuerfel', { force: true });                    // Wurf bei 1:59,8
  await page.clock.runFor(200);
  const mitten = await uhr();
  ok(mitten.um && await phase(page) === 'rollt' && mitten.versuche === 2, 'Wurf bei 1:59,8: um 2:00,0 ist die Zeit um, der Würfel rollt noch');
  await page.clock.runFor(500);
  const zahl = await page.evaluate(() => window.wuerfelSpiel.zahl);
  ok(await phase(page) === 'aus' && (await page.textContent('#augenzahl')) === String(zahl) && (await page.textContent('#los-text')) === 'Die Zeit ist um!',
    `… landet auf seiner Zahl (${zahl}), dann „Die Zeit ist um!“`);
  // iPhone gesperrt: Timer schlafen, die Uhrzeit läuft weiter – der nächste Tipp merkt, dass die Zeit um ist
  await page.click('#los');
  await page.clock.runFor(1000);
  const start3 = await page.evaluate(() => Date.now()) - 1000;
  await page.clock.setSystemTime(start3 + 125000);                  // Uhrzeit springt, ohne dass ein Timer feuert
  await page.click('#wuerfel', { force: true });
  ok(await phase(page) === 'aus' && (await uhr()).versuche === 1 && (await page.textContent('#uhr')) === '2:00,0 · 1 Versuch',
    'Timer verschlafen (gesperrtes iPhone): der nächste Tipp würfelt nicht mehr, die Zeit ist um');
  // Zurück: die Übung bricht ab, beim nächsten Mal wieder „Start“ und die Uhr versteckt
  await page.click('#los'); await page.clock.runFor(3000);
  await page.click('#zurueck');
  await page.click('#zahlwahl button[data-n="9"]'); await page.clock.runFor(300);
  ok(await phase(page) === 'warten' && (await uhr()).versuche === 0 && !(await uhr()).laeuft && await page.isHidden('#uhr')
    && (await page.textContent('#los')) === 'Start', 'Zurück und wieder rein: wieder „Start“, nichts läuft, Uhr versteckt');
  await halten('#spielseite .titel', 3200);
  await halten('#spielseite .titel', 3200);
  ok(await page.isHidden('#uhr'), 'Noch einmal 3 s drücken: Uhr weg');
  await page.click('#zurueck');
  await lange(page, '#startseite h2', 3200, true);
  await page.click('#zahlwahl button[data-n="9"]');
  await page.clock.runFor(300);
  await page.waitForFunction(() => { const i = document.querySelector('#tier-bild'); return i.complete && i.naturalWidth > 0; });
  await halten('#tier-zahl', 3200);
  ok(await page.isVisible('#uhr'), 'Auch über die runde 9 am Tier');
  for (const [w, h] of [[390, 844], [375, 667], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h }); await page.clock.runFor(200);
    const m = await page.evaluate(() => { let u = 0; for (const f of document.querySelectorAll('#koerper > *')) u = Math.max(u, f.getBoundingClientRect().bottom);
      const k = document.querySelector('#los').getBoundingClientRect(), z = document.querySelector('#uhr').getBoundingClientRect(), t = document.querySelector('#tier-bild').getBoundingClientRect();
      return { wuerfel: u, knopfOben: k.top, knopfUnten: k.bottom, uhr: z.top, unten: z.bottom, tier: t.height, scroll: document.scrollingElement.scrollHeight > innerHeight + 1 }; });
    ok(m.knopfOben >= m.wuerfel && m.uhr >= m.knopfUnten && m.unten <= h && !m.scroll && m.tier >= 60,
      `${w}×${h} mit Tier: Würfel, Start, Uhr untereinander, nichts verdeckt, kein Scrollen (Tier ${Math.round(m.tier)} px)`);
    if (bilder && w === 390) await page.screenshot({ path: `${bilder}/start-tier.png` });
  }
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}
console.log('Fassung umschalten: 3 s auf den Erklärtext der Startseite');
{
  const { page, konsole, ctx } = await seite(390, 844, false, '');
  const istSagen = () => page.evaluate(() => document.body.classList.contains('sagen'));
  ok(await istSagen() && (await page.textContent('#erklaerung')).includes('sag laut'), 'Anfangs „nur Würfel“ – der Erklärtext sagt, was zu tun ist');
  await lange(page, '#erklaerung', 1200);
  ok(await istSagen(), 'Kurz drücken (1,2 s): bleibt');
  await lange(page, '#erklaerung');
  ok(!(await istSagen()) && (await page.textContent('#erklaerung')).includes('tippe unten die Zahl an') && (await page.textContent('#update-text')) === 'Fassung: mit Zahlen unten',
    '3 s: „Fassung: mit Zahlen unten“, der Erklärtext wechselt mit');
  await page.click('#zahlwahl button[data-n="5"]');
  await page.waitForTimeout(300);
  ok(await page.isVisible('#zahlen') && await page.isVisible('#los') && await phase(page) === 'warten', 'Spielseite mit Zahlenleiste und „Start“');
  await page.click('#zurueck');
  await page.reload();
  ok(!(await istSagen()), 'Die Wahl bleibt nach dem Neuladen');
  await lange(page, '#erklaerung');
  ok(await istSagen() && (await page.textContent('#update-text')) === 'Fassung: nur Würfel', 'Noch einmal 3 s: wieder „nur Würfel“');
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Zahl antippen: auch „Start“ und genau 2 Minuten (Uhr vorgespult)');
{
  const T0 = new Date('2026-10-17T10:00:00Z').getTime();
  const { page, konsole, ctx } = await seite(390, 844, false, '?tippen', p => p.clock.install({ time: T0 }));
  await page.clock.pauseAt(T0 + 5000);
  const uhr = () => page.evaluate(() => window.wuerfelSpiel.uhr);
  const oben = () => page.evaluate(() => Math.round(document.querySelector('#wuerfel').getBoundingClientRect().top));
  await page.click('#zahlwahl button[data-n="6"]'); await page.clock.runFor(300);
  ok(await page.isVisible('#zahlen') && await page.isVisible('#los') && await page.locator('#stand').count() === 0, 'Zahlenleiste und „Start“, kein Zähler „0/7“');
  const lage0 = await oben();
  await page.click('#los'); await page.clock.runFor(700);
  ok(await page.isHidden('#los') && await sichtbar(page, '#gleichung') && await oben() === lage0, '„Start“: erster Wurf, Gleichung steht da, der Würfel bleibt an seinem Platz');
  let wuerfe = 1, richtig = 0, verraten = 0;
  const gezogen = [];
  while ((await uhr()).vergangen < 116000) {
    const k = await page.evaluate(() => window.wuerfelSpiel.zahl);
    gezogen.push(k);
    const sn = await page.evaluate(() => window.wuerfelSpiel.seiten);
    if ([sn.oben, sn.rechts].some(x => x === String(k) || x === String(6 - k))) verraten++;
    await page.click(`.zahl[data-zahl="${6 - k}"]`);
    if (await phase(page) === 'geloest') richtig++;
    await page.clock.runFor(2500);                                 // Lösung steht, dann „Tippe auf den Würfel!“
    await page.click('#wuerfel', { force: true }); wuerfe++;
    await page.clock.runFor(700);
  }
  ok(richtig === wuerfe - 1 && verraten === 0, `${wuerfe} Würfe in knapp 2 Minuten, jede Antwort gewertet, keine Nebenseite verrät etwas (${gezogen.join(' ')})`);
  ok(new Set(gezogen).size >= 5 && gezogen.some((x, i) => i && x === gezogen[i - 1]) || gezogen.length < 20,
    'Gewürfelt wie mit einem echten Würfel: keine Runden, Doppelte kommen vor');
  await page.clock.runFor(120000 - (await uhr()).vergangen);
  ok(await phase(page) === 'aus' && (await page.textContent('#los-text')) === 'Die Zeit ist um!' && await page.isVisible('#los') && (await page.textContent('#los')) === 'Nochmal',
    'Bei genau 2:00,0: „Die Zeit ist um!“ und „Nochmal“');
  ok(!(await sichtbar(page, '#gleichung')) && (await page.textContent('#hinweis')) === '' && await oben() === lage0, 'Gleichung und Hinweis sind weg, nichts verschiebt sich');
  ok((await page.textContent('#uhr')) === `2:00,0 · ${wuerfe} Versuche` && await page.isVisible('#uhr'), `Am Ende: „2:00,0 · ${wuerfe} Versuche“`);
  ok(await page.evaluate(() => Math.round(document.querySelector('#fortschritt').getBoundingClientRect().width)) === 390, 'Zeitlinie oben über die ganze Breite');
  await page.click('.zahl[data-zahl="3"]');
  ok(await phase(page) === 'aus' && !(await page.evaluate(() => document.body.classList.contains('falsch') || document.body.classList.contains('gut'))),
    'Danach zählt die Zahlenleiste nicht mehr (kein Rot, kein Grün)');
  const m = await page.evaluate(() => { const l = document.querySelector('#los').getBoundingClientRect(), z = document.querySelector('#zahlen').getBoundingClientRect(),
    u = document.querySelector('#uhr').getBoundingClientRect(); return { los: l.bottom, uhr: u.top, uhrUnten: u.bottom, zahlen: z.top }; });
  ok(m.los <= m.uhr && m.uhrUnten <= m.zahlen, '„Nochmal“, Uhr und Zahlenleiste untereinander, nichts überdeckt');
  if (bilder) await page.screenshot({ path: `${bilder}/tippen-ende.png` });
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Gesagte Zahl (nachgestellt, Uhr vorgespult): würfelt von selbst weiter');
for (const adresse of ['', '?tippen']) {
  const T0 = new Date('2026-10-17T10:00:00Z').getTime();
  const { page, konsole, ctx } = await seite(390, 844, false, adresse, p => p.clock.install({ time: T0 }));
  await page.clock.pauseAt(T0 + 5000);
  const s = () => page.evaluate(() => ({ phase: window.wuerfelSpiel.phase, zahl: window.wuerfelSpiel.zahl, uhr: window.wuerfelSpiel.uhr,
    gut: document.body.classList.contains('gut'), falsch: document.body.classList.contains('falsch') }));
  const sag = k => page.evaluate(k => window.wuerfelSpiel.gesagt(k), k);
  const name = adresse ? '„mit Zahlen unten“' : '„nur Würfel“';
  await page.click('#zahlwahl button[data-n="8"]'); await page.clock.runFor(300);
  await sag(3);
  ok((await s()).phase === 'warten', `${name}: vor „Start“ zählt nichts`);
  await page.click('#los');
  await sag(3);
  ok((await s()).uhr.versuche === 1 && (await s()).uhr.richtig + (await s()).uhr.falsch === 0, `${name}: während der Würfel rollt, zählt nichts`);
  await page.clock.runFor(700);
  let a = await s();
  await sag(8 - a.zahl);
  let b = await s();
  if (!adresse) ok(b.phase === 'rollt' && b.uhr.versuche === 2 && b.uhr.richtig === 1, `${name}: richtige Zahl → zählt „richtig“ und würfelt sofort neu`);
  else {
    ok(b.phase === 'geloest' && b.gut && b.uhr.richtig === 1 && (await gleichung(page)) === `${a.zahl}+${8 - a.zahl}=8`, `${name}: richtige Zahl → grün, Lösung steht da`);
    await page.clock.runFor(1600);
    ok((await s()).uhr.versuche === 2, `${name}: … nach 1,5 s würfelt er von selbst weiter`);
  }
  await page.clock.runFor(700);
  a = await s();
  const falsch = (8 - a.zahl + 1) % 9;
  await sag(falsch);
  b = await s();
  if (!adresse) ok(b.phase === 'rollt' && b.uhr.falsch === 1, `${name}: falsche Zahl → zählt „falsch“, würfelt trotzdem weiter`);
  else {
    ok(b.falsch && b.phase === 'frage' && b.uhr.falsch === 1, `${name}: falsche Zahl → kurz rot`);
    await page.clock.runFor(1000);
    ok((await s()).phase !== 'frage' || (await s()).uhr.versuche === 3, `${name}: … dann geht es trotzdem weiter`);
  }
  await page.clock.runFor(120000);
  await sag(5);
  ok((await s()).phase === 'aus' && (await s()).uhr.richtig + (await s()).uhr.falsch === 2, `${name}: nach den 2 Minuten zählt nichts mehr`);
  ok(konsole.length === 0, 'Keine Fehler in der Konsole' + (konsole.length ? ': ' + konsole.join(' | ') : ''));
  await ctx.close();
}

console.log('Auch mit „Bewegung reduzieren“ (iPhone: Bedienungshilfen → Bewegung)');
{
  const { page, ctx } = await seite(390, 844, true);
  await page.click('#zahlwahl button[data-n="6"]');
  await tippe(page);
  const lagen = new Set();
  while (await phase(page) === 'rollt') { lagen.add(await lage(page)); await page.waitForTimeout(40); }
  ok(lagen.size >= 4, `Der ganze Würfel dreht sich trotzdem (${lagen.size} Lagen gesehen)`);
  const k = await page.evaluate(() => window.wuerfelSpiel.zahl);
  await page.click(`.zahl[data-zahl="${6 - k}"]`);
  await page.waitForFunction(() => window.wuerfelSpiel.phase === 'bereit', null, { timeout: 4000 });
  await page.waitForTimeout(2300);
  const dauer = await page.evaluate(() => getComputedStyle(document.querySelector('#hinweis')).animationDuration);
  ok(dauer === '1.8s', `Auch nach einer Lösung und bei „Bewegung reduzieren“ leuchtet der Hinweis nach 2 s (${dauer})`);
  await ctx.close();
}

console.log('Nichts lässt sich schieben');
for (const [breite, hoehe] of [[390, 844], [375, 667]]) {
  const { page, ctx } = await seite(breite, hoehe);
  for (const ziel of ['start', 'spiel']) {
    if (ziel === 'spiel') await page.click('#zahlwahl button[data-n="10"]');
    const m = await page.evaluate(() => {
      window.scrollTo(0, 500); document.documentElement.scrollTop = 500; document.body.scrollTop = 500;
      const s = getComputedStyle(document.body);
      return { y: window.scrollY + document.documentElement.scrollTop + document.body.scrollTop, fest: s.position === 'fixed' && s.overflow === 'hidden' };
    });
    await page.mouse.move(breite / 2, hoehe / 2); await page.mouse.wheel(0, 600); await page.waitForTimeout(150);
    const y = await page.evaluate(() => window.scrollY + document.documentElement.scrollTop + document.body.scrollTop);
    ok(m.fest && m.y === 0 && y === 0, `${breite}×${hoehe} ${ziel === 'start' ? 'Startseite' : 'Spielseite'}: steht fest, scrollt nicht`);
  }
  // Inhalt der Spielseite passt komplett: alle Zahlknöpfe innerhalb des Bildschirms
  const passt = await page.evaluate(() => [...document.querySelectorAll('#spielseite .zahl')]
    .every(el => el.getBoundingClientRect().bottom <= innerHeight && el.getBoundingClientRect().top >= 0));
  ok(passt, `${breite}×${hoehe}: alles Nötige ist sichtbar, ohne zu scrollen`);
  await ctx.close();
}

console.log('Passt aufs kleine iPhone (375 × 667)');
for (const n of [4, 7, 10]) {
  const { page, ctx } = await seite(375, 667);
  await page.click(`#zahlwahl button[data-n="${n}"]`);
  await wuerfle(page);
  const m = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.zahl')].map(z => z.getBoundingClientRect());
    return {
      breit: document.documentElement.scrollWidth, letzte: r.at(-1).bottom,
      knopf: Math.min(...r.map(q => q.width)), hoch: Math.min(...r.map(q => q.height)),
      eineReihe: r.every(q => Math.abs(q.top - r[0].top) < 1),
      aufsteigend: r.every((q, i) => !i || q.left > r[i - 1].left),
      rand: Math.min(r[0].left, innerWidth - r.at(-1).right),
    };
  });
  ok(m.eineReihe && m.aufsteigend, `${n}: alle Zahlen in einer Reihe, klein links, groß rechts`);
  ok(m.rand >= 4, `${n}: Leiste bleibt im Bildschirm (Rand ${m.rand.toFixed(0)} px)`);
  ok(m.breit <= 375, `${n}: kein seitliches Scrollen (${m.breit} px)`);
  ok(m.letzte <= 667, `${n}: alle Zahlen ohne Scrollen sichtbar (unterste Kante ${Math.round(m.letzte)} px)`);
  ok(m.knopf >= 28 && m.hoch >= 60, `${n}: Tasten ${Math.round(m.knopf)} × ${Math.round(m.hoch)} px (schmal, dafür hoch und mit Lupe)`);
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
  await ctx.close();
}

console.log('Echtzeit: 2 Minuten mit der echten Uhr (lief parallel zu allem anderen)');
{
  const e = await echt;
  const ms = x => Math.round(x).toLocaleString('de-DE');
  ok(e.innen >= 120000 && e.innen <= 120300, `In der Seite gemessen: ${ms(e.innen)} ms von „Start“ bis „Die Zeit ist um!“ (Soll 120.000, nie früher)`);
  // von außen (Uhr von Node): der Klick selbst dauert einige ms, die wahre Dauer liegt im Fenster [von, bis]
  ok(e.bis >= 120000 && e.von <= 120300, `Von außen gemessen: ${ms(e.von)} … ${ms(e.bis)} ms (die Spanne ist die Dauer des Klicks, ${ms(e.bis - e.von)} ms) – passt zu 120.000`);
  ok(e.uhr.versuche === 12 && e.anzeige === '2:00,0 · 12 Versuche', `12 Würfe gezählt; am Ende steht von selbst „${e.anzeige}“ (Uhr war aus)`);
  ok(e.konsole.length === 0, 'Keine Fehler in der Konsole' + (e.konsole.length ? ': ' + e.konsole.join(' | ') : ''));
}

await browser.close();
server.close();
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles grün');
process.exit(fehler ? 1 : 0);
