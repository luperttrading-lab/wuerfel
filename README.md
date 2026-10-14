# Würfel-Zahlen

Zahlen-Lernspiel fürs Handy: Würfel aussuchen, antippen, Punkte zählen, Zahl antippen.
Richtig → grün und Fanfare, falsch → rot und tiefer Ton, nochmal versuchen.

**Spielen:** https://luperttrading-lab.github.io/wuerfel/ (auf dem iPhone über *Teilen → Zum Home-Bildschirm*)

- **Würfel:** bis 6 (klassische Augen), bis 10 (Zehnerfeld 2 × 5), bis 20 (Zwanzigerfeld 2 × 10).
  Farbwechsel nach jedem Fünfer, leere Felder bleiben sichtbar.
- **Wie viele?** – die gewürfelte Anzahl antippen.
- **Was fehlt bis …?** – die Ergänzung antippen (bis 10: 3 gewürfelt → 7). Nach der richtigen
  Antwort wird die Ergänzung grün ins Feld gezeichnet.
- Zahlenknöpfe immer 0 bis Höchstzahl. Sterne zählen richtige Antworten.
- Würfel gleichverteilt (`crypto.getRandomValues` mit Verwerfung, kein Modulo-Überhang).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | ganze App (HTML, CSS, JS); `APP_VERSION` bei jeder Änderung hochzählen |
| `sw.js` | Service Worker, Netz zuerst (Updates kommen an, offline läuft es weiter) |
| `manifest.webmanifest`, `*.png` | Home-Bildschirm-Symbol |
| `tests/spiel.mjs` | Browser-Test: `node tests/spiel.mjs [bildordner]` |
| `tools/kosten.py` | Kostenzeile für Claude-Sitzungen |
