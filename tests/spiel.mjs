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

  // Leiser Hinweis: erst nach 2 s beginnt „Tippe auf den Würfel!“ die Farbe zu wechseln
  ok(!(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt'))), 'Hinweis anfangs ruhig');
  await page.waitForTimeout(2200);
  const farben = new Set();
  for (let i = 0; i < 6; i++) { farben.add(await page.evaluate(() => getComputedStyle(document.querySelector('#hinweis')).color)); await page.waitForTimeout(150); }
  ok(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt')) && farben.size >= 3,
    `Nach 2 s wechselt der Hinweis sanft die Farbe (${farben.size} Farbtöne gesehen)`);
  const farbeVorher = await page.evaluate(() => getComputedStyle(document.querySelector('.zahl')).backgroundColor);
  await page.click('.zahl[data-zahl="4"]');
  ok(await phase(page) === 'bereit', 'Zahl antippen vor dem Würfeln zählt nicht');
  ok((await page.textContent('#hinweis')).includes('Erst würfeln'), 'Stattdessen der Hinweis „Erst würfeln!“');

  const t0 = Date.now();
  await page.click('#wuerfel', { force: true });
  ok(await phase(page) === 'rollt', 'Antippen: Würfel rollt');
  ok(!(await page.evaluate(() => document.querySelector('#hinweis').classList.contains('lockt'))), 'Beim Würfeln hört der Hinweis auf');
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
  ok(staubMax >= 150, `Beim Wirbeln fliegt viel Staub (bis ${staubMax} Körner gleichzeitig)`);
  ok(lagenRollen.size >= 20 && wechsel >= 6, `Beim Rollen überschlägt er sich (${lagenRollen.size} Lagen) und die Zahlen wechseln (${wechsel}×)`);
  ok(dauer >= 1900 && dauer <= 2600, `Rollen dauert ${dauer} ms (Soll 2 s)`);
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

console.log('Tiere (einschaltbar)');
{
  const { page, konsole, ctx } = await seite(390, 844);
  const geladen = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].every(i => i.complete && i.naturalWidth > 0 && i.offsetWidth > 0), sel);
  ok(await page.getAttribute('#tiere-schalter', 'aria-pressed') === 'false' && await page.isHidden('#zahlwahl img'),
    'Beim ersten Laden: ohne Tiere');
  await page.click('#zahlwahl button[data-n="7"]');
  ok(await page.isHidden('#tier'), 'Beim ersten Laden: kein Tier auf der Spielseite');
  await page.click('#zurueck');
  const quellen = () => page.evaluate(() => [...document.querySelectorAll('#zahlwahl img')].map(i => i.getAttribute('src')));
  await page.click('#tiere-schalter');
  ok(await page.getAttribute('#tiere-schalter', 'aria-pressed') === 'true' && await page.getAttribute('#tiere-schalter', 'data-satz') === 'sticker',
    'Tatzen 1×: Sticker-Tiere');
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
    }
    ok(!zugedeckt.length, `${w} px, ${satz}: Zahlplakette verdeckt bei keinem der 7 Tiere etwas` + (zugedeckt.length ? ' – ' + zugedeckt.join(', ') : ''));
  }
  await page.evaluate(() => { window.wuerfelSpiel.stand.tiere = 'sticker'; window.wuerfelSpiel.starteSpiel(7); });
  for (const [w, h, min] of [[320, 568, 100], [375, 667, 160], [390, 844, 170], [430, 932, 190]]) {
    await page.setViewportSize({ width: w, height: h });
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      return { groesse: r('#tier-bild').width, oben: r('#tier-bild').top, unten: r('#tier-bild').bottom, kopf: r('#spielseite .kopf').bottom, wuerfel: r('.sockel').top };
    });
    ok(m.groesse >= min && m.oben >= m.kopf && m.unten <= m.wuerfel,
      `${w}×${h}: Tier groß (${Math.round(m.groesse)} px), zwischen Kopfzeile und Würfel`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const k = await wuerfle(page);
  await page.click(`.zahl[data-zahl="${7 - k}"]`);
  ok(await page.evaluate(() => document.querySelector('#tier').classList.contains('hops')), 'Richtige Antwort: das Tier hüpft vor Freude');
  await page.click('#zurueck');
  await page.click('#tiere-schalter');
  await page.waitForTimeout(300);
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild' && await geladen('#zahlwahl img')
    && (await quellen()).every((q, i) => q === `tiere/wild/${i + 4}.webp`), 'Tatzen 2×: wilde Tiere auf den Starttasten');
  await page.click('#zahlwahl button[data-n="7"]');
  await page.waitForTimeout(300);
  ok(await page.getAttribute('#tier-bild', 'src') === 'tiere/wild/7.webp' && await geladen('#tier-bild'), 'Spielseite: der wilde Seestern über dem Würfel');
  await page.click('#zurueck');
  await page.reload();
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'wild', 'Die Wahl (wild) bleibt nach dem Neuladen');
  await page.click('#tiere-schalter');
  ok(await page.getAttribute('#tiere-schalter', 'aria-pressed') === 'false' && await page.isHidden('#zahlwahl img'), 'Tatzen 3×: wieder ohne Tiere');
  await page.click('#zahlwahl button[data-n="7"]');
  ok(await page.isHidden('#tier'), 'Ohne Tiere: kein Tier auf der Spielseite');
  await page.click('#zurueck');
  await page.click('#tiere-schalter'); await page.click('#tiere-schalter'); await page.click('#tiere-schalter');
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'aus', 'Dreimal schnell hintereinander: einmal rundherum (Hinweis fängt keine Tipps ab)');
  await page.evaluate(() => localStorage.setItem('wuerfel.stand', JSON.stringify({ n: 7, tiere: true })));
  await page.reload();
  ok(await page.getAttribute('#tiere-schalter', 'data-satz') === 'sticker', 'Alte Einstellung „Tiere an“ (vor v0.29) wird zu Sticker');
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
