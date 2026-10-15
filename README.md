# Würfel – Zahlen zerlegen

Lernspiel fürs Handy, damit sich die Zerlegungen der Zahlen 4 bis 10 als **Ziffern** einprägen
(3 + 7 = 10), ohne Punkte oder Plättchen.

**Spielen:** https://luperttrading-lab.github.io/wuerfel/ (auf dem iPhone über *Teilen → Zum Home-Bildschirm*)

1. **Startseite:** „Welche Zahl zerlegen wir?“ – 4 bis 10 in einer Reihe.
2. **Echter 3D-Würfel**, fast von vorn (10° / 12° geneigt, oben und rechts nur schmale Kanten).
   Abgerundete Kanten: 12 schräge Kantenstreifen mit Lichtverlauf und 8 Eckdreiecke mit
   baryzentrisch gemischtem Licht – Lage und Größe aller 26 Teile rechnet `baueKoerper()`.
   In Ruhe steht vorne die gewählte Zahl (lila), die Nebenseiten sind grau.
3. **Antippen:** Luftzug-Geräusch, dann wirbelt er 2 Sekunden auf der Stelle und wird langsamer:
   fünf Überschläge, zwei Drehungen seitwärts, eine um die eigene Mitte. Dabei wird er kleiner
   (bis 70 %) und wieder groß, der Schatten schrumpft mit; Staub stiebt kräftig (4×) hinter ihm hervor
   und verweht bis etwa 1,9 s. Bei 1,76 s schlägt er auf: „Bumm“, er staucht sich kurz (91 % hoch),
   ein Staubwölkchen am Boden. Die Ziffern wirken eingeprägt. Bei jedem
   Überschlag klickt es (25-mal). Seiten, die gerade nach hinten zeigen, bekommen neue Zahlen;
   die Vorderseite bekommt die ausgeloste Zahl, solange sie verdeckt ist (bis 1,56 s), und liegt
   ab 1,72 s vorn (blau). Darunter steht `3 + ? = 8`. Die sichtbaren Nebenseiten zeigen nie die
   gewürfelte Zahl oder die Lösung.
   Der Würfel dreht sich auch, wenn am iPhone „Bewegung reduzieren“ eingeschaltet ist – das
   Drehen ist hier der Kern des Spiels.
4. Unten die fehlende Zahl antippen: alle Zahlen 0 bis zur gewählten Zahl in **einer Leiste** wie ein
   Zahlenstrahl (klein links, groß rechts). Die Tasten sind schmal (bei 10: ~30 pt), deshalb wie bei der
   iPhone-Tastatur eine **Lupe** über dem Finger; man kann seitlich rutschen, es zählt die Taste beim
   Loslassen. Immer Bernstein mit dunkler Schrift (Kontrast ≈ 8,6 : 1), in jedem Zustand gleich;
   wer vor dem Würfeln tippt, bekommt „Erst würfeln!“.
   Richtig → grün, Fanfare, `3 + 5 = 8`, aus der eingesetzten Zahl steigt eine Fontäne goldener
   Sterne (60, nach einer ganzen Runde 132). Falsch → rot, tiefer Ton, nochmal versuchen.
   Kein Punktestand auf dem Bildschirm – Üben ohne Druck. Die App zählt richtige Antworten nur still
   mit (`stand.sterne`), als Grundlage, falls später eine Auswertung dazukommt.
5. Danach zeigt der Würfel wieder die 8; die gelöste Gleichung bleibt zum Einprägen stehen,
   bis zum nächsten Antippen. Vor der ersten Aufgabe steht nur „Tippe auf den Würfel!“.
   Wird 2 s lang nicht getippt, wechselt dieser Hinweis sanft die Farbe (Schwarz ↔ Lila der Würfelzahl,
   alle 1,8 s) – auch bei „Bewegung reduzieren“, denn Farbe ist keine Bewegung.

**Tiere** (Schalter 🐾 auf der Startseite: aus → Sticker → wild & bunt → aus; beim ersten Laden aus, die Wahl wird gespeichert): jede Zahl hat ihr Tier, gewählt nach dem
Anlaut des Zahlworts – 4 **V**ogel, 5 **F**rosch, 6 **S**eepferdchen, 7 **S**eestern (7 Arme, einer
nach oben: 3 + 1 + 3), 8 Oktopus (Ausnahme: *okto* = acht, 8 Arme als 4 + 4), 9 **N**ashorn,
10 **Z**ebra. Auf der Spielseite sitzt das Tier groß über dem Würfel (freier Platz, bis 62 % der
Breite bzw. 280 px hoch; das Feld hat die Form des Tiers, breite Tiere werden breit statt klein), die Zahl als Plakette rechts unten daneben („wir sind beim Oktopus, bei der 8“).
Es hüpft bei jeder richtigen Antwort, nach einer ganzen Runde zweimal. Schalter aus = ohne Tiere.

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

**Effekte** (am Gerät mit Reglern ausprobiert, dann fest eingestellt): Staub 4× (`STAUB`), 60 Sterne
bei jeder richtigen Antwort, 132 nach einer ganzen Runde (`STERNE`).

**Zufall:** Gezogen wird **ohne Zurücklegen**: Jede Zerlegung 0 + n … n + 0 kommt pro Runde
genau einmal (bei 10: 11 Würfe statt im Mittel 11 · H₁₁ ≈ 33,2 mit einem echten Würfel), danach
„Alle Zerlegungen geschafft!“ und eine neue Runde. Die erste Zahl einer Runde ist nie die letzte
der vorigen.

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
| `tools/kosten.py` | Kostenzeile für Claude-Sitzungen |
