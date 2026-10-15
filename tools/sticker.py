"""Schneidet die Tier-Sticker aus und schreibt tiere/4.webp … tiere/10.webp.

Vorlage (in tiere/quelle/), in dieser Reihenfolge gesucht:
  1. einzelne Bilder je Tier: 4.png, 5.jpg, … (Dateiendung png, jpg, jpeg oder webp)
  2. sonst der Streifen sticker.jpg / sticker.png mit allen sieben Stickern von links (4 Vogel … 10 Zebra)
Einzelbilder gehen vor, auch gemischt: ein neuer Frosch als 5.png ersetzt nur den Frosch aus dem Streifen.

Der hellgraue Grund wird von den Ecken her geflutet und durchsichtig; der weiße Stickerrand bleibt.
Bilder mit eigener Transparenz (PNG) werden so übernommen. Jeder Sticker wird in ein Quadrat
eingepasst (94 %) und auf GROESSE Pixel gebracht (größte Anzeige 210 px × 3 auf dem iPhone).

Aufruf im Projektordner: python3 tools/sticker.py
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ORDNER = Path('tiere/quelle')
GROESSE = 640
ZAHLEN = range(4, 11)
GRUND_TOLERANZ = 14   # Summe der Kanalabweichungen; der weiße Rand (255) liegt ~20 über dem Grund (~248)


def finde(name):
    for endung in ('png', 'jpg', 'jpeg', 'webp'):
        if (ORDNER / f'{name}.{endung}').exists():
            return ORDNER / f'{name}.{endung}'


def spalten(streifen):
    """Spalten (von, bis), in denen sich etwas vom Grund abhebt – unabhängig von der Auflösung."""
    grund = streifen.getpixel((2, 2))
    abweichung = ImageChops.difference(streifen, Image.new('RGB', streifen.size, grund)).convert('L')
    profil = list(abweichung.point(lambda v: 255 if v > 13 else 0).resize((streifen.width, 1), Image.BOX).tobytes())
    teile, an = [], None
    for x, v in enumerate(profil + [0]):
        if v and an is None:
            an = x
        elif not v and an is not None:
            if x - an > streifen.width / 100:   # Staub und JPEG-Rauschen überspringen
                teile.append((an, x))
            an = None
    return teile


def freistellen(bild):
    """RGBA-Bild des Stickers, Grund durchsichtig, eng zugeschnitten."""
    if bild.mode in ('RGBA', 'LA', 'P') and bild.convert('RGBA').getextrema()[3][0] < 255:
        rgba = bild.convert('RGBA')                       # bringt eigene Transparenz mit
        return rgba.crop(rgba.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    farbe = bild.convert('RGB')
    geflutet = farbe.copy()
    for ecke in [(0, 0), (farbe.width - 1, 0), (0, farbe.height - 1), (farbe.width - 1, farbe.height - 1)]:
        ImageDraw.floodfill(geflutet, ecke, (255, 0, 255), thresh=GRUND_TOLERANZ)
    maske = ImageChops.difference(geflutet, Image.new('RGB', farbe.size, (255, 0, 255))).convert('L')
    maske = maske.point(lambda v: 255 if v > 0 else 0)
    maske = maske.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))   # Schattensaum weg, Kante weich
    rahmen = maske.point(lambda v: 255 if v > 20 else 0).getbbox()
    farbe.putalpha(maske)
    return farbe.crop(rahmen)


quellen = {}
streifen_datei = finde('sticker')
if streifen_datei and any(not finde(n) for n in ZAHLEN):
    streifen = Image.open(streifen_datei).convert('RGB')
    teile = spalten(streifen)
    if len(teile) != len(ZAHLEN):
        raise SystemExit(f'{streifen_datei}: {len(teile)} Sticker gefunden, erwartet {len(ZAHLEN)}')
    rand = round(streifen.height * .05)
    for n, (x0, x1) in zip(ZAHLEN, teile):
        quellen[n] = (f'{streifen_datei.name} [{x0}–{x1}]', streifen.crop((max(x0 - rand, 0), 0, min(x1 + rand, streifen.width), streifen.height)))
for n in ZAHLEN:
    if finde(n):
        quellen[n] = (finde(n).name, Image.open(finde(n)))
    if n not in quellen:
        raise SystemExit(f'Keine Vorlage für {n}: weder {ORDNER}/{n}.png noch ein Streifen sticker.jpg')

for n in ZAHLEN:
    herkunft, bild = quellen[n]
    sticker = freistellen(bild)
    faktor = GROESSE * .94 / max(sticker.size)
    neu = (round(sticker.width * faktor), round(sticker.height * faktor))
    alpha = sticker.getchannel('A').resize(neu, Image.LANCZOS)
    farbe = sticker.convert('RGB').resize(neu, Image.LANCZOS)
    if faktor > 1.2:                                       # hochgerechnet: etwas nachschärfen
        farbe = farbe.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    farbe.putalpha(alpha)
    ziel = Image.new('RGBA', (GROESSE, GROESSE), (0, 0, 0, 0))
    ziel.alpha_composite(farbe, ((GROESSE - neu[0]) // 2, (GROESSE - neu[1]) // 2))
    ziel.save(f'tiere/{n}.webp', quality=82, method=6)
    print(f'tiere/{n}.webp  aus {herkunft}, Sticker {sticker.width}×{sticker.height} px, ×{faktor:.2f}'
          + ('  ← unscharf, größere Vorlage nötig' if faktor > 1.5 else ''))
