# Würfel – Zahlen zerlegen

Lernspiel fürs Handy, damit sich die Zerlegungen der Zahlen 4 bis 10 als **Ziffern** einprägen
(3 + 7 = 10), ohne Punkte oder Plättchen.

**Spielen:** https://luperttrading-lab.github.io/wuerfel/ (auf dem iPhone über *Teilen → Zum Home-Bildschirm*)

1. **Startseite:** „Welche Zahl zerlegen wir?“ – 4, 5, 6, 7, 8, 9 oder 10.
2. **Echter 3D-Würfel**, leicht schräg von oben (drei Seiten sichtbar). In Ruhe steht vorne die
   gewählte Zahl (lila), die Nebenseiten sind grau.
3. **Antippen:** Er überschlägt sich 2 Sekunden lang immer langsamer (drei Überschläge, eine
   Drehung seitwärts), bei jedem Überschlag klickt es. Seiten, die gerade nach hinten zeigen,
   bekommen neue Zahlen. Die Vorderseite bekommt die ausgeloste Zahl, solange sie verdeckt ist
   (bis 73 % der Zeit), und rollt als Letzte nach vorn (blau). Darunter steht `3 + ? = 8`.
   Die sichtbaren Nebenseiten zeigen nie die gewürfelte Zahl oder die Lösung.
4. Unten die fehlende Zahl antippen (Knöpfe 0 bis zur gewählten Zahl).
   Richtig → grün, Fanfare, `3 + 5 = 8`. Falsch → rot, tiefer Ton, nochmal versuchen.
5. Danach zeigt der Würfel wieder die 8; die gelöste Gleichung bleibt zum Einprägen stehen,
   bis zum nächsten Antippen. Vor der ersten Aufgabe steht nur „Tippe auf den Würfel!“.

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
| `tests/spiel.mjs` | Browser-Test: `node tests/spiel.mjs [bildordner]` |
| `tools/kosten.py` | Kostenzeile für Claude-Sitzungen |
