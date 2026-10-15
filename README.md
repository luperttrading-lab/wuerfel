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
5. Danach zeigt der Würfel wieder die 8; die gelöste Gleichung bleibt zum Einprägen stehen,
   bis zum nächsten Antippen. Vor der ersten Aufgabe steht nur „Tippe auf den Würfel!“.
   Wird 2 s lang nicht getippt, wechselt dieser Hinweis sanft die Farbe (Schwarz ↔ Lila der Würfelzahl,
   alle 1,8 s) – auch bei „Bewegung reduzieren“, denn Farbe ist keine Bewegung.

**Tiere** (Schalter 🐾 auf der Startseite, Start: an): jede Zahl hat ihr Tier, gewählt nach dem
Anlaut des Zahlworts – 4 **V**ogel, 5 **F**rosch, 6 **S**eepferdchen (der Schwanz ist eine 6),
7 **S**eestern (7 Arme, einer nach oben: 3 + 1 + 3), 8 Oktopus (Ausnahme: *okto* = acht, 8 Arme als
4 + 4), 9 **N**ashorn, 10 **Z**ebra. Regel fürs Zeichnen: Beine und Arme sind nur zu sehen, wenn ihre
Anzahl die Zahl ist – sonst lernt das Kind beim Oktopus „Beine zählen“ und liest am Frosch eine 4.
Auf der Spielseite sitzt das Tier mit seiner Zahl über dem Würfel („wir sind beim Oktopus, bei der 8“)
und hüpft bei jeder richtigen Antwort, nach einer ganzen Runde zweimal. Schalter aus = die Fassung
ohne Tiere.

Die runden Plaketten sind von Hand als SVG gezeichnet (`tiere/quelle/*.svg`): braune, leicht
handgezogene Kontur, Papierkorn, Licht von oben links. Diese Papierstruktur sind SVG-Filter, die
nicht jeder Browser gleich rendert (Safari) – darum liefert die App fertig gerasterte Bilder aus
(`tiere/*.webp`, 384 px, je ~20–27 KB). Nach jeder Änderung an einer Quelle: `node tools/tiere.mjs`.

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
| `manifest.webmanifest`, `*.png` | Home-Bildschirm-Symbol |
| `tiere/4.webp` … `tiere/10.webp` | Tier-Plaketten je Zahl (gerastert von `tools/tiere.mjs`) |
| `tiere/quelle/*.svg` | Zeichnungen der Tiere (Quelle) |
| `tests/spiel.mjs` | Browser-Test: `node tests/spiel.mjs [bildordner]` |
| `tools/kosten.py` | Kostenzeile für Claude-Sitzungen |
