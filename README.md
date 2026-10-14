# Würfel – Zahlen zerlegen

Lernspiel fürs Handy, damit sich die Zerlegungen der Zahlen 4 bis 10 als **Ziffern** einprägen
(3 + 7 = 10), ohne Punkte oder Plättchen.

**Spielen:** https://luperttrading-lab.github.io/wuerfel/ (auf dem iPhone über *Teilen → Zum Home-Bildschirm*)

1. **Startseite:** „Welche Zahl zerlegen wir?“ – 4, 5, 6, 7, 8, 9 oder 10.
2. **Würfel dreht sich**, jede Vierteldrehung zeigt eine neue Ziffer. Antippen hält ihn an.
3. Er bleibt auf einer Zahl stehen, darunter steht `3 + ? = 10`.
4. Unten die fehlende Zahl antippen (Knöpfe 0 bis zur gewählten Zahl).
   Richtig → grün, Fanfare, `3 + 7 = 10`, dann dreht er von selbst weiter.
   Falsch → rot, tiefer Ton, nochmal versuchen.

**Zufall:** Die Zahl wird im Moment des Antippens ausgelost; der Würfel läuft dann darauf aus.
Der Zeitpunkt des Tippens entscheidet also nichts – sonst würde ein Kind lernen, „seine“ Zahl
abzupassen. Gezogen wird **ohne Zurücklegen**: Jede Zerlegung 0 + n … n + 0 kommt pro Runde
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
