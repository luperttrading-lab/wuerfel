"""Schneidet die Tier-Sticker aus tiere/quelle/sticker.jpg und schreibt tiere/4.webp … tiere/10.webp.

Die Vorlage ist ein Streifen mit sieben Stickern (weißer Rand) auf hellgrauem Grund, erzeugt mit
einem Bildgenerator. Der Grund wird von den Ecken her geflutet und durchsichtig; der weiße
Stickerrand bleibt. Jeder Sticker wird in ein Quadrat eingepasst (94 %) und auf GROESSE Pixel
gebracht (größte Anzeige 210 px × 3 auf dem iPhone).

Aufruf im Projektordner: python3 tools/sticker.py
"""
from PIL import Image, ImageChops, ImageDraw, ImageFilter

QUELLE = 'tiere/quelle/sticker.jpg'
GROESSE = 640
# Spalten der sieben Sticker im Streifen (Pixel von–bis), von links: 4 Vogel … 10 Zebra
SPALTEN = {4: (63, 287), 5: (456, 649), 6: (806, 1053), 7: (1178, 1398), 8: (1523, 1792), 9: (1902, 2154), 10: (2300, 2491)}
GRUND_TOLERANZ = 14   # Summe der Kanalabweichungen; der weiße Rand (255) liegt ~20 über dem Grund (~248)

streifen = Image.open(QUELLE).convert('RGB')
for n, (x0, x1) in SPALTEN.items():
    stueck = streifen.crop((max(x0 - 12, 0), 0, min(x1 + 12, streifen.width), streifen.height))
    geflutet = stueck.copy()
    for ecke in [(0, 0), (stueck.width - 1, 0), (0, stueck.height - 1), (stueck.width - 1, stueck.height - 1)]:
        ImageDraw.floodfill(geflutet, ecke, (255, 0, 255), thresh=GRUND_TOLERANZ)
    grund = ImageChops.difference(geflutet, Image.new('RGB', stueck.size, (255, 0, 255))).convert('L')
    maske = grund.point(lambda v: 255 if v > 0 else 0)
    maske = maske.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))   # Schattensaum weg, Kante weich
    rahmen = maske.point(lambda v: 255 if v > 20 else 0).getbbox()
    farbe, maske = stueck.crop(rahmen), maske.crop(rahmen)

    faktor = GROESSE * 0.94 / max(farbe.width, farbe.height)
    neu = (round(farbe.width * faktor), round(farbe.height * faktor))
    farbe = farbe.resize(neu, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    maske = maske.resize(neu, Image.LANCZOS)
    farbe.putalpha(maske)

    bild = Image.new('RGBA', (GROESSE, GROESSE), (0, 0, 0, 0))
    bild.alpha_composite(farbe, ((GROESSE - neu[0]) // 2, (GROESSE - neu[1]) // 2))
    bild.save(f'tiere/{n}.webp', quality=82, method=6)
    print(f'tiere/{n}.webp  {neu[0]}×{neu[1]} (×{faktor:.1f})')
