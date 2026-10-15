"""Gemeinsames Freistellen für tools/sticker.py und tools/wild.py.

„Farbe zu Transparenz“: je Pixel wird ausgerechnet, wie viel Grundfarbe darin steckt, und genau das
wird durchsichtig. Weiche Ränder bleiben weich, kein heller Saum. Was innen liegt (vom Bildrand aus
nur durch das Tier erreichbar: Augenweiß, weiße Zebrastreifen, grauer Nashornkörper), bleibt voll
deckend – sonst verschwände alles, was der Grundfarbe ähnelt.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

KERN = 0.25             # ab diesem Farbanteil zählt ein Pixel zum Tier (Umriss, Fläche, Spritzer)
SAUM = 3                # so breit (px in der Vorlage) bleibt der Rand weich


def freistellen(bild, grund=None, rauschen=.04, aussen_blass=0):
    """RGBA, eng zugeschnitten. grund: Farbe, die verschwinden soll (Standard: Median am Bildrand).
    rauschen: Deckung, die noch als Grund gilt (JPEG-Rauschen, leichter Schatten).
    aussen_blass: was außen (mit dem Bildrand verbunden) blasser ist, wird ganz durchsichtig –
    z. B. der Schattenhauch, wo bei den Stickern früher der weiße Rand endete."""
    p = np.asarray(bild.convert('RGB')).astype(np.float32)
    if grund is None:
        rand = np.concatenate([p[:6].reshape(-1, 3), p[-6:].reshape(-1, 3), p[:, :6].reshape(-1, 3), p[:, -6:].reshape(-1, 3)])
        grund = np.median(rand, axis=0)
    grund = np.asarray(grund, dtype=np.float32)

    # kleinster Deckungsgrad, mit dem sich das Pixel aus der Grundfarbe mischen lässt
    hoch = np.where(p > grund, (p - grund) / np.maximum(255 - grund, 1), 0)
    tief = np.where(p < grund, (grund - p) / np.maximum(grund, 1), 0)
    alpha = np.clip((np.maximum(hoch, tief).max(axis=2) - rauschen) / (1 - rauschen), 0, 1)

    # innen = vom Bildrand aus nicht erreichbar, ohne das Tier zu kreuzen
    weg = Image.fromarray(np.where(alpha > KERN, 0, 255).astype('uint8')).copy()
    for ecke in [(0, 0), (weg.width - 1, 0), (0, weg.height - 1), (weg.width - 1, weg.height - 1)]:
        if weg.getpixel(ecke) == 255:
            ImageDraw.floodfill(weg, ecke, 128)
    aussen = np.asarray(weg) == 128
    alpha = np.where(aussen & (alpha < aussen_blass), 0, alpha)
    innen = Image.fromarray(np.where(aussen, 0, 255).astype('uint8'))
    tief_innen = np.asarray(innen.filter(ImageFilter.MinFilter(2 * SAUM + 1))) == 255
    alpha = np.where(tief_innen, 1, alpha)

    # Farbe entmischen: p = a·f + (1 − a)·g  →  f = (p − (1 − a)·g) / a
    a3 = alpha[..., None]
    farbe = np.clip((p - (1 - a3) * grund) / np.maximum(a3, 1e-3), 0, 255)
    rgba = Image.fromarray(np.dstack([farbe, alpha * 255]).round().astype('uint8'), 'RGBA')
    return rgba.crop(rgba.getchannel('A').point(lambda v: 255 if v > 25 else 0).getbbox())


def zuschneiden(rgba, kante, rand=.02):
    """Eng um das Tier, Seitenverhältnis bleibt (kein Quadrat mit leeren Streifen): die längere Seite wird
    kante px, ringsum ein schmaler durchsichtiger Rand für den Schatten. Vormultipliert verkleinert,
    damit kein dunkler Saum entsteht."""
    faktor = kante * (1 - 2 * rand) / max(rgba.size)
    neu = (round(rgba.width * faktor), round(rgba.height * faktor))
    klein = rgba.convert('RGBa').resize(neu, Image.LANCZOS).convert('RGBA')
    r = round(kante * rand)
    ziel = Image.new('RGBA', (neu[0] + 2 * r, neu[1] + 2 * r), (0, 0, 0, 0))
    ziel.alpha_composite(klein, (r, r))
    return ziel, faktor
