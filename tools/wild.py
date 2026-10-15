"""Schneidet die wilden Aquarell-Tiere aus und schreibt tiere/wild/4.webp … tiere/wild/10.webp.

Vorlagen: tiere/quelle/wild/4.jpg … 10.jpg (1024 px, Tier mit Farbspritzern auf hellgrauem Grund).

Aquarell läuft weich in den Grund aus – ein harter Schnitt ließe einen grauen Saum stehen. Darum
„Farbe zu Transparenz“ gegen das Grau (tools/freistellen.py): Ränder und Spritzer bleiben weich,
was innen liegt (grauer Nashornkörper, Augenweiß), bleibt voll deckend.

Aufruf im Projektordner: python3 tools/wild.py
"""
from pathlib import Path
from PIL import Image
from freistellen import freistellen, ins_quadrat

QUELLE, ZIEL = Path('tiere/quelle/wild'), Path('tiere/wild')
GROESSE = 560           # Anzeige 179 px × 3 auf dem iPhone (390 pt); Aquarell ist teuer, darum nicht 640

ZIEL.mkdir(exist_ok=True)
for n in range(4, 11):
    tier = freistellen(Image.open(QUELLE / f'{n}.jpg'))                      # Grund: Grau vom Bildrand
    bild, faktor = ins_quadrat(tier, GROESSE)
    bild.save(ZIEL / f'{n}.webp', quality=68, alpha_quality=75, method=6)
    print(f'tiere/wild/{n}.webp  Tier {tier.width}×{tier.height} px, ×{faktor:.2f}')
