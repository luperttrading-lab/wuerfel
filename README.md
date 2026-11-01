# Würfel – Zahlen zerlegen

Lernspiel fürs Handy, damit sich die Zerlegungen der Zahlen 4 bis 10 als **Ziffern** einprägen
(3 + 7 = 10), ohne Punkte oder Plättchen.

**Spielen:** https://luperttrading-lab.github.io/wuerfel/ (auf dem iPhone über *Teilen → Zum Home-Bildschirm*)

1. **Startseite:** „Welche Zahl zerlegen wir?“ – 4 bis 10 in einer Reihe.
2. **Echter 3D-Würfel**, fast von vorn (10° / 12° geneigt, oben und rechts nur schmale Kanten).
   Abgerundete Kanten: 12 schräge Kantenstreifen mit Lichtverlauf und 8 Eckdreiecke mit
   baryzentrisch gemischtem Licht – Lage und Größe aller 26 Teile rechnet `baueKoerper()`.
   In Ruhe steht vorne die gewählte Zahl (lila), die Nebenseiten sind grau.
3. **Antippen:** Luftzug-Geräusch, dann wirbelt er eine halbe Sekunde auf der Stelle und wird langsamer:
   zwei Überschläge, eine Drehung seitwärts, eine um die eigene Mitte (bis v0.34: 2 s, v0.35: 1 s).
   Mehr Überschläge in der Zeit würden flimmern (anfangs 48° pro Bild, ab ~60° flimmert es), einer allein
   ließe keine Zeit, die Zahl verdeckt aufzumalen. Dabei wird er kleiner
   (bis 70 %) und wieder groß, der Schatten schrumpft mit; Staub stiebt kräftig (4×) hinter ihm hervor
   und verweht bis etwa 0,85 s. Bei 0,44 s schlägt er auf: „Bumm“, er staucht sich kurz (91 % hoch),
   ein Staubwölkchen am Boden. Die Ziffern wirken eingeprägt. Bei jedem
   Überschlag klickt es. Seiten, die gerade nach hinten zeigen, bekommen neue Zahlen;
   die Vorderseite bekommt die ausgeloste Zahl, während sie hochkant oder verdeckt ist (0,20–0,34 s,
   mehr als 81° weggedreht), und liegt ab 0,43 s vorn (blau). Die Animation rückt pro Bild höchstens
   40 ms vor: ruckelt das Gerät, rollt er einen Hauch länger, statt dieses Fenster zu überspringen –
   die Zahl springt nie sichtbar um. Darunter steht `3 + ? = 8`. Die sichtbaren Nebenseiten zeigen nie die
   gewürfelte Zahl oder die Lösung.
   Der Würfel dreht sich auch, wenn am iPhone „Bewegung reduzieren“ eingeschaltet ist – das
   Drehen ist hier der Kern des Spiels.
4. Unten die fehlende Zahl antippen: alle Zahlen 0 bis zur gewählten Zahl in **einer Leiste** wie ein
   Zahlenstrahl (klein links, groß rechts). Die Tasten sind schmal (bei 10: ~30 pt), deshalb wie bei der
   iPhone-Tastatur eine **Lupe** über dem Finger; man kann seitlich rutschen, es zählt die Taste beim
   Loslassen. Immer Bernstein mit dunkler Schrift (Kontrast ≈ 8,6 : 1), in jedem Zustand gleich;
   wer vor dem Start tippt, bringt „Start“ zum Wackeln.
   Richtig → grün, Fanfare, `3 + 5 = 8`, aus der eingesetzten Zahl steigt eine Fontäne goldener
   Sterne (60). Falsch → rot, tiefer Ton. Kein Punktestand auf dem Bildschirm – Üben ohne Druck; gezählt
   wird still (Uhr und Ende: „· N richtig“).
5. Danach würfelt er von selbst weiter (richtig: nach 0,35 s, während die Sterne fliegen; falsch: nach 0,8 s);
   die Lösung bleibt stehen, bis die neue Aufgabe landet. Vor dem ersten Wurf steht unter dem Würfel „Start“.

**Zwei Fassungen.** Standard ist **Sagen**: nur der Würfel (ohne Text, Zähler, Zahlenleiste und Gleichung).
Unter dem Würfel „Bereit?“ und **Start**: ab dann laufen genau 2 Minuten, der erste Wurf rollt gleich mit.
Antippen würfelt, das Kind sagt laut, was bis n fehlt, Antippen würfelt weiter. Gewürfelt wird wie mit einem
echten Würfel: jede Zahl 0 … n gleich wahrscheinlich, unabhängig vom vorigen Wurf – Doppelte kommen vor
(bei n = 9 jeder zehnte Wurf), und eine Zerlegung kann auch länger ausbleiben. Die Fassungen heißen seit v0.53
**„nur Würfel“** (vorher „laut sagen“) und **„mit Zahlen unten“** (Zahlenleiste, Gleichung, Lupe, richtig/falsch) hat ebenfalls „Start“, 2 Minuten, Zeitlinie, Uhr und
Versuche am Ende; „Start“ und „Nochmal“ liegen dort über Gleichung und Hinweis, nichts verschiebt sich.
**Umschalten:** 3 s auf den Erklärtext unter den Zahlen der Startseite („Fassung: mit Zahlen unten“ bzw. „nur
Würfel“, gespeichert); der Erklärtext zeigt, welche Fassung an ist. Die alte Adresse `…/?tippen` schaltet auch
noch um. Bis v0.48 zog „Antippen“ in Runden („0/10“, jede Zerlegung genau einmal) – das ist raus.
Ohne Tiere steht nichts über dem Würfel.

**Tiere** – versteckt, für Erwachsene: Beim Laden sind sie immer aus, ohne 🐾 und 💨 in der Kopfzeile.
**3 Sekunden** auf „Welche Zahl zerlegen wir?“ (oder auf „Würfel“ oben links) drücken schaltet sie an, noch einmal 3 s
wieder aus. Die Versionsnummer bleibt der Update-Knopf. Sind sie an, erscheint 🐾 und wechselt zwischen Sticker und
wild & bunt; gemerkt wird nur dieser Satz, nicht ob sie an waren. Jede Zahl hat ihr Tier, gewählt nach dem
Anlaut des Zahlworts – 4 **V**ogel, 5 **F**rosch, 6 **S**eepferdchen, 7 **S**eestern (7 Arme, einer
nach oben: 3 + 1 + 3), 8 Oktopus (Ausnahme: *okto* = acht, 8 Arme als 4 + 4), 9 **N**ashorn,
10 **Z**ebra. Auf der Spielseite sitzt das Tier groß über dem Würfel (freier Platz, bis 62 % der
Breite bzw. 280 px hoch; das Feld hat die Form des Tiers, breite Tiere werden breit statt klein), die Zahl als Plakette rechts unten daneben („wir sind beim Oktopus, bei der 8“).
Es hüpft bei jeder richtigen Antwort.

Die Sticker kommen aus einem Bildgenerator, je Tier eine Vorlage (`tiere/quelle/4.jpg` … `10.jpg`,
~800–1000 px, aus Bildschirmfotos ausgeschnitten – der Chat-Upload verkleinert breite Bilder,
Einzelbilder kommen in voller Größe an). `python3 tools/sticker.py` stellt sie **ohne den weißen
Stickerrand** frei („Farbe zu Transparenz“ gegen Weiß, `tools/freistellen.py`): Weißes im Tier (Augen,
Zebrastreifen) bleibt, weil es innerhalb des Umrisses liegt; der Schattenhauch des früheren Randes
geht mit. Ergebnis `tiere/*.webp` (eng zugeschnitten, längere Seite 760 px, nur verkleinert, also scharf). Offene Punkte: Der Frosch
zeigt 4 Beine (bei der 5 lädt das zum falschen Zählen ein), das Seepferdchen liegt waagerecht statt
als 6. Die frühere gezeichnete Fassung (SVG mit Papierstruktur) liegt in der Git-Historie (bis v0.23).

Zweiter Satz **wild & bunt**: Aquarell-Tiere mit Farbspritzern (`tiere/quelle/wild/4.jpg` … `10.jpg`,
1024 px). `python3 tools/wild.py` rechnet den grauen Grund pro Pixel heraus (dasselbe `tools/freistellen.py`),
damit die weichen Aquarellränder und Spritzer bleiben; was innen liegt (grauer Nashornkörper, weiße
Zebrastreifen) bleibt voll deckend. Ergebnis `tiere/wild/*.webp` (eng zugeschnitten, längere Seite 700 px, je ~110–180 KB; wird erst
geladen, wenn der Satz gewählt ist). Auch hier: Oktopus genau 8 Arme (4 + 4), Seestern genau 7.

**2 Minuten**: gemessen an der Uhrzeit des Geräts (`Date.now()`, `DAUER` = 120 000 ms) – sie läuft auch weiter,
wenn das iPhone zwischendurch gesperrt ist. Bei genau 2:00,0 ist Schluss: Fanfare, Sterne, „Die Zeit ist um!“
und **Nochmal** (neue 2 Minuten). Rollt der Würfel gerade, landet er noch auf seiner Zahl. Danach würfelt er
nicht mehr; hat ein Timer verschlafen, merkt es der nächste Tipp. Zurück zur Startseite bricht ab.
Versteckt für Erwachsene: 3 Sekunden auf „Zerlegen: 9“ drücken (mit Tieren auch auf die runde Zahl am Tier) –
unten erscheint die laufende Uhr mit den Versuchen, z. B. `1:23,4 · 17 Versuche`; ein Versuch ist ein Wurf
(„Start“ zählt als erster). Noch einmal 3 s drücken blendet sie aus. Ihr Platz ist immer reserviert,
Ein- und Ausblenden verschiebt nichts; Schrift der App mit gleich breiten Ziffern. Nach den 2 Minuten steht sie
von selbst da (`2:00,0 · 23 Versuche`) – zur Auswertung: richtig zählt der Erwachsene, die Versuche die App.
Abschalten: am Ende 3 s auf „Die Zeit ist um!“ oder auf „Nochmal“ drücken („Versuche am Ende: aus“, gespeichert),
noch einmal 3 s schaltet sie wieder an. Ist die Uhr an, steht sie am Ende ohnehin da. „Start“/„Nochmal“ startet
nur bei einem normalen Tipp (unter 1 s losgelassen); länger gedrückt startet nichts. Die Hinweise „Uhr an/aus“
und „Versuche am Ende: an/aus“ stehen 3,6 s (`SCHALTER_HINWEIS`).
**Linie für die Zeit:** Am oberen Rand wächst während der 2 Minuten eine 3 pt dünne Linie von links nach rechts,
in der Farbe des Statusleisten-Streifens darüber (`--bg`, #2b5a98 – am iPhone malt iOS diesen Streifen in
unserer Grundfarbe, die App beginnt darunter). Sie sieht aus, als würde dessen Unterkante langsam dicker;
halb = 1 Minute, ganz = um. Ohne Ziffern, ohne Sprünge (3,25 pt pro Sekunde): wer weiß, wo er hinschaut,
sieht sie, das Kind schaut auf den Würfel. Dicke: in v0.45 am Gerät mit 1/2/3 pt verglichen, festgelegt auf 3 pt
(evtl. später 2 pt; `height` von `.fortschritt`). Geprüft wird die Zeit zweimal: mit
vorgespulter Browser-Uhr auf die Millisekunde (119 999 ms läuft, 120 000 ms Schluss) und einmal echt
2 Minuten lang: in der Seite 120 002–120 003 ms, von außen (Uhr von Node) ein Fenster um 120 000 ms, so breit wie der Klick dauert.
(Die Zähl-Statistik aus v0.41 ist wieder raus.) In „Zahl antippen“ ist unter dem Würfel Platz für „Start“ und
die Uhr reserviert; auf kleinen iPhones wird das Tier dort kleiner (375 × 667: 155 px, 320 × 568: 78 px).

**Hilfe (ⓘ)**: oben auf der Startseite ein dezentes ⓘ. 3 s drücken öffnet „Geheime Schalter“: zu jedem Schalter
ein Mini-Bildschirm mit pulsierendem Ring, wo man drückt („3 s“ oder „tippen“), daneben die Erklärung und was
gerade eingestellt ist (Tiere, Staub, Versuche am Ende, Fassung). Kurz tippen öffnet nichts, zeigt nur „Für Erwachsene:
3 Sekunden drücken“. Schließen mit ✕, daneben tippen oder Esc; der Inhalt scrollt (sonst ist Wischen gesperrt).

**Sprechen** (3 s auf 🔊, gespeichert; am 🔊 sitzt dann ein kleines 🎤): Während der 2 Minuten hört die App zu. Sagt
das Kind eine Zahl, zählt sie still richtig oder falsch und würfelt von selbst weiter – auch bei einer falschen Zahl
(so gewünscht). „Nur Würfel“: sofort der nächste Wurf. „Mit Zahlen unten“: wie angetippt (siehe unten); mit Sprechen
an gibt es dort keine Zahlenleiste – entweder sagen oder tippen. Uhr und Ende zeigen dann z. B. „23 Versuche · 19 richtig“. Gewertet wird nur bei
offener Aufgabe (nicht beim Rollen, nicht vor „Start“, nicht nach den 2 Minuten). Mikrofon nur während der 2 Minuten;
vorher stellt die App die Tonsitzung auf `play-and-record`, danach zurück auf `playback`. vosk.js und Modell werden
erst geladen, wenn Sprechen an ist. Kurz auf 🔊 tippen bleibt Ton an/aus. Ohne Mikrofon (verweigert, nicht da) kommt
ein Hinweis, das Spiel läuft normal. Am iPhone mit Erwachsenenstimme geprüft (Sprechtest 20/20), Kinderstimme offen;
offen auch, wie laut die Würfelgeräusche bei eingeschaltetem Mikrofon sind.

**Antwort antippen** („mit Zahlen unten“, seit v0.54): Nach jeder Antwort würfelt er von selbst weiter, statt wieder
die ganze Zahl zu zeigen und auf einen Tipp zu warten. Richtig → grün, Sterne, Lob, nach 0,35 s rollt er schon wieder,
während die Sterne fliegen; die Lösung bleibt stehen, bis die neue Aufgabe landet. Falsch → kurz rot, nach 0,8 s weiter
(kein „Probier es nochmal!“ mehr). Beides zählt still mit; Uhr und Ende zeigen „· N richtig“. Der leise, farbwechselnde
Hinweis „Tippe auf den Würfel!“ ist damit weggefallen.

**Sprechtest** (`sprechtest.html`, Versuch; in der ⓘ-Hilfe verlinkt): Versteht das iPhone die Zahl, die das Kind
sagt? Apples eingebaute Spracherkennung ist in Home-Bildschirm-Apps gesperrt (WebKit-Bug 225298), darum erkennt
die Seite selbst, auf dem Gerät: Vosk als WebAssembly (`sprache/vosk.js`) mit dem kleinen deutschen Modell (45 MB,
einmal geladen; entpackt ~95 MB in IndexedDB, danach in 1–2 s bereit). Erlaubt sind nur die Wörter „null“ … „zehn“
(plus „ein“, „zwo“) – mit dieser Liste erkannte das Modell Testwörter 11/11, ohne sie 8/11 („eins“ → „hans“,
„zehn“ → „sein“). Ablauf: Zahl erscheint, Kind sagt sie, nach 20 Zahlen „x von 20 richtig verstanden“, Verwechslungen,
Antwortzeit (~0,9 s nach Beginn des Sprechens). Im Testbrowser mit Ersatz-Mikrofon (Computerstimme, Erwachsene)
20/20 – Kinderstimmen und das echte iPhone-Mikrofon sind noch ungeprüft. `node tests/sprechtest.mjs folge.wav`
prüft das mit einer eigenen Aufnahme (liegt nicht im Repo). Der Service Worker lässt `sprache/` aus.
Wichtig fürs iPhone: Das Spiel setzt `navigator.audioSession.type = 'playback'` (Ton trotz Stummschalter); das gilt
in der Home-Bildschirm-App weiter und sperrt das Mikrofon („AudioSession category is not compatible with audio
capture“, am Gerät gesehen in v0.51). Vor `getUserMedia` darum `'play-and-record'`.

**Hintergrund**: helles Tiefblau mit Licht in der Mitte (`--grund`); der weiße Würfel hebt sich mit
gut 4 : 1 ab (vorher Creme: 1,1 : 1). Schrift auf dem Grund ist hell, Zahlfarben auf dem Grund haben
helle Varianten (`--teil-hell`, `--ganz-hell`, `--rest-hell`); auf dem Würfel bleiben die kräftigen.
Statusleiste am iPhone durchscheinend mit weißer Schrift.

**Staub** nur mit Tieren (Schalter 💨 auf der Startseite, erscheint mit den Tieren, Start: an): bunt – Tupfer
in sechs kräftigen Farben, die beim Wirbeln aus dem Würfel stieben. Ohne Tiere oder mit 💨 aus fliegt kein
einziges Korn. Die Wahl wird gespeichert.

**Effekte** (am Gerät mit Reglern ausprobiert, dann fest eingestellt): Staub 4× (`STAUB`), 60 Sterne
bei jeder richtigen Antwort, 132 wenn die 2 Minuten um sind (`STERNE`).

**Zufall:** In beiden Fassungen wie mit einem echten Würfel – jede Zahl 0 … n gleich wahrscheinlich
(`crypto.getRandomValues`, Verwerfungsmethode), unabhängig vom vorigen Wurf. Bis v0.48 zog „Antippen“ ohne
Zurücklegen (jede Zerlegung genau einmal pro Runde).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | ganze App (HTML, CSS, JS); `APP_VERSION` bei jeder Änderung hochzählen |
| `sw.js` | Service Worker, Netz zuerst (Updates kommen an, offline läuft es weiter) |
| `manifest.webmanifest`, `*.png` | Home-Bildschirm-Symbol: der Würfel aus dem Spiel (lila 8) auf Bernstein, gebaut von `tools/icon.py` aus `icon-quelle/wuerfel-8.png`; `icon-maskable.png` mit mehr Rand für Android. iOS übernimmt ein neues Symbol erst, wenn die App neu zum Home-Bildschirm hinzugefügt wird |
| `tiere/4.webp` … `tiere/10.webp` | Tier-Sticker je Zahl (ausgeschnitten von `tools/sticker.py`) |
| `tiere/quelle/4.jpg` … `10.jpg` | Vorlagen der Sticker, je Tier ein Bild |
| `tiere/wild/*.webp`, `tiere/quelle/wild/*.jpg` | zweiter Satz „wild & bunt“ und seine Vorlagen (`tools/wild.py`) |
| `tests/spiel.mjs` | Browser-Test: `node tests/spiel.mjs [bildordner]` |
| `sprechtest.html`, `sprache/` | Versuch Spracherkennung: Testseite, `vosk.js`, deutsches Modell (`sprache/LIZENZ.md`) |
| `tests/sprechtest.mjs` | Spracherkennung mit Ersatz-Mikrofon: `node tests/sprechtest.mjs folge.wav` |
| `tools/kosten.py` | Kostenzeile für Claude-Sitzungen |
