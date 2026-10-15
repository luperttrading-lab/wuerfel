"""Stellt die Tier-Sticker frei und schreibt tiere/4.webp … tiere/10.webp.

Vorlagen: tiere/quelle/4.jpg … 10.jpg (je ein Sticker mit weißem Rand auf hellgrauem Grund, ~800–1000 px,
aus Bildschirmfotos ausgeschnitten – der Chat-Upload verkleinert breite Bilder, Einzelbilder nicht).
Freigestellt wird gegen Weiß: Grund und weißer Stickerrand verschwinden, das Tier steht ohne Rand.
Weißes im Tier (Augen, Zebrastreifen) bleibt, weil es innerhalb des Umrisses liegt (tools/freistellen.py).

Aufruf im Projektordner: python3 tools/sticker.py
"""
from pathlib import Path
from PIL import Image
from freistellen import freistellen, zuschneiden

QUELLE, GROESSE = Path('tiere/quelle'), 760           # längere Seite; Anzeige bis ~242 px × 3 = 726 auf dem iPhone (390 pt)

for n in range(4, 11):
    vorlage = next(QUELLE / f'{n}.{e}' for e in ('png', 'jpg', 'jpeg', 'webp') if (QUELLE / f'{n}.{e}').exists())
    tier = freistellen(Image.open(vorlage), grund=(255, 255, 255), rauschen=.10, aussen_blass=.3)   # ohne Schattenhauch
    bild, faktor = zuschneiden(tier, GROESSE)
    bild.save(f'tiere/{n}.webp', quality=82, method=6)
    print(f'tiere/{n}.webp  aus {vorlage.name}, {bild.width}×{bild.height} px, ×{faktor:.2f}')
