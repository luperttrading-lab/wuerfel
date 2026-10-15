"""Schneidet die wilden Aquarell-Tiere aus und schreibt tiere/wild/4.webp … tiere/wild/10.webp.

Vorlagen: tiere/quelle/wild/4.jpg … 10.jpg (1024 px, Tier mit Farbspritzern auf hellgrauem Grund).

Aquarell läuft weich in den Grund aus – ein harter Schnitt ließe einen grauen Saum stehen. Darum
„Farbe zu Transparenz“: je Pixel wird ausgerechnet, wie viel Grau darin steckt, und genau das wird
durchsichtig. Ränder und Spritzer bleiben weich. Was innen liegt (vom Rand aus nur durch das Tier
erreichbar, z. B. der graue Nashornkörper oder das Augenweiß), bleibt voll deckend – sonst würde
alles, was dem Grau ähnelt, mit verschwinden.

Aufruf im Projektordner: python3 tools/wild.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

QUELLE, ZIEL = Path('tiere/quelle/wild'), Path('tiere/wild')
GROESSE = 560           # Anzeige 179 px × 3 auf dem iPhone (390 pt); Aquarell ist teuer, darum nicht 640
KERN = 0.25             # ab diesem Farbanteil zählt ein Pixel zum Tier (Umriss, Fläche, Spritzer)
SAUM = 3                # so breit (px in der Vorlage) bleibt der Rand weich

ZIEL.mkdir(exist_ok=True)
for n in range(4, 11):
    bild = Image.open(QUELLE / f'{n}.jpg').convert('RGB')
    p = np.asarray(bild).astype(np.float32)
    rand = np.concatenate([p[:6].reshape(-1, 3), p[-6:].reshape(-1, 3), p[:, :6].reshape(-1, 3), p[:, -6:].reshape(-1, 3)])
    grund = np.median(rand, axis=0)

    # Farbe zu Transparenz: kleinster Deckungsgrad, mit dem sich das Pixel aus dem Grau mischen lässt
    hoch = np.where(p > grund, (p - grund) / (255 - grund), 0)
    tief = np.where(p < grund, (grund - p) / grund, 0)
    alpha = np.clip((np.maximum(hoch, tief).max(axis=2) - .04) / .96, 0, 1)      # JPEG-Rauschen im Grund weg

    # innen = vom Bildrand aus nicht erreichbar, ohne das Tier zu kreuzen
    weg = Image.fromarray(np.where(alpha > KERN, 0, 255).astype('uint8')).copy()
    for ecke in [(0, 0), (weg.width - 1, 0), (0, weg.height - 1), (weg.width - 1, weg.height - 1)]:
        if weg.getpixel(ecke) == 255:
            ImageDraw.floodfill(weg, ecke, 128)
    innen = Image.fromarray(np.where(np.asarray(weg) == 128, 0, 255).astype('uint8'))
    tief_innen = np.asarray(innen.filter(ImageFilter.MinFilter(2 * SAUM + 1))) == 255
    alpha = np.where(tief_innen, 1, alpha)

    # Farbe entmischen: p = a·f + (1 − a)·g  →  f = (p − (1 − a)·g) / a
    a3 = alpha[..., None]
    farbe = np.clip((p - (1 - a3) * grund) / np.maximum(a3, 1e-3), 0, 255)
    rgba = Image.fromarray(np.dstack([farbe, alpha * 255]).round().astype('uint8'), 'RGBA')

    rahmen = rgba.getchannel('A').point(lambda v: 255 if v > 25 else 0).getbbox()
    rgba = rgba.crop(rahmen)
    faktor = GROESSE * .94 / max(rgba.size)
    neu = (round(rgba.width * faktor), round(rgba.height * faktor))
    rgba = rgba.convert('RGBa').resize(neu, Image.LANCZOS).convert('RGBA')         # vormultipliert: kein dunkler Saum
    ziel = Image.new('RGBA', (GROESSE, GROESSE), (0, 0, 0, 0))
    ziel.alpha_composite(rgba, ((GROESSE - neu[0]) // 2, (GROESSE - neu[1]) // 2))
    ziel.save(ZIEL / f"{n}.webp", quality=68, alpha_quality=75, method=6)
    print(f'tiere/wild/{n}.webp  Grund {grund.round().astype(int).tolist()}, Tier {rahmen[2] - rahmen[0]}×{rahmen[3] - rahmen[1]} px, ×{faktor:.2f}')
