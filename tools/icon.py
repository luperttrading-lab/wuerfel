"""Baut die App-Icons aus icon-quelle/wuerfel-8.png (der Würfel aus dem Spiel, ausgeschnitten).

Bernstein-Hintergrund (Farbe der Antworttasten) mit weichem Verlauf, Würfel gerade, weicher Schatten.
  apple-touch-icon.png  180 px   iPhone-Home-Bildschirm (iOS rundet die Ecken selbst ab)
  icon-192.png          192 px   Browser/Android
  icon-512.png          512 px   Android, Würfel groß
  icon-maskable.png     512 px   Android mit runder/beliebiger Maske: Würfel kleiner, bleibt im
                                 sicheren Kreis (80 % Durchmesser)
Der Würfel wird für jede Größe direkt aus der Vorlage verkleinert (520 px), nie hochgerechnet.

Aufruf im Projektordner: python3 tools/icon.py
"""
import math
from PIL import Image, ImageDraw, ImageFilter

WUERFEL = Image.open('icon-quelle/wuerfel-8.png')
HELL, DUNKEL = (0xff, 0xd9, 0x8a), (0xff, 0x9f, 0x2e)    # Bernstein, Licht von oben links


def verlauf(g):
    bild = Image.new('RGB', (g, g))
    px = bild.load()
    cx, cy, r = g * .32, g * .22, g * 1.05
    for y in range(g):
        for x in range(g):
            t = min(1, math.hypot(x - cx, y - cy) / r)
            px[x, y] = tuple(round(HELL[i] + (DUNKEL[i] - HELL[i]) * t) for i in range(3))
    return bild


def icon(g, anteil):
    bild = verlauf(g).convert('RGBA')
    s = anteil * g / max(WUERFEL.size)
    w = WUERFEL.resize((round(WUERFEL.width * s), round(WUERFEL.height * s)), Image.LANCZOS)
    x, y = (g - w.width) // 2, round((g - w.height) / 2 - g * .025)
    schatten = Image.new('RGBA', (g, g), (0, 0, 0, 0))
    ImageDraw.Draw(schatten).ellipse((x + w.width * .12, y + w.height * .9, x + w.width * .92, y + w.height * 1.04),
                                     fill=(20, 10, 40, 95))
    bild.alpha_composite(schatten.filter(ImageFilter.GaussianBlur(g * .022)))
    bild.alpha_composite(w, (x, y))
    return bild.convert('RGB')                               # iOS mag keine Transparenz (wird schwarz)


for datei, groesse, anteil in [('apple-touch-icon.png', 180, .74), ('icon-192.png', 192, .74),
                               ('icon-512.png', 512, .74), ('icon-maskable.png', 512, .58)]:
    icon(groesse, anteil).save(datei, optimize=True)
    print(f'{datei}  {groesse} px, Würfel {round(anteil * 100)} %')
