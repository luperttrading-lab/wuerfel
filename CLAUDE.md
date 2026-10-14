# Würfel – Zahlen zerlegen

Lern-App fürs iPhone (Home-Bildschirm), ausgeliefert über GitHub Pages von `main`:
https://luperttrading-lab.github.io/wuerfel/

## Arbeitsregeln

- **Jede Antwort endet mit dem Link** https://luperttrading-lab.github.io/wuerfel/ als letzter
  inhaltlicher Zeile, direkt über der Kostenzeile (`python3 tools/kosten.py`, die bleibt ganz unten).
- `APP_VERSION` in `index.html` bei jeder Änderung hochzählen (Update-Mechanismus, Skill app-update-iphone).
- Vor dem Push: `node tests/spiel.mjs` muss „Alles grün“ melden.
- Nach dem Push warten, bis Pages die neue Version ausliefert, erst dann „online“ melden.
