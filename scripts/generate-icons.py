"""Rebuild the procedural Rahmat app icons (requires Pillow; not needed to export)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'public' / 'icons'
SCALE = 4
FOREST, CREAM, GOLD = '#244D40', '#F7F5EF', '#C9AC6A'

def curve(start, a, b, end):
    points = []
    for n in range(65):
        t = n / 64
        u = 1 - t
        points.append(((u**3*start[0] + 3*u*u*t*a[0] + 3*u*t*t*b[0] + t**3*end[0])*SCALE,
                       (u**3*start[1] + 3*u*u*t*a[1] + 3*u*t*t*b[1] + t**3*end[1])*SCALE))
    return points

def stroke(draw, points, color, width):
    draw.line(points, fill=color, width=width*SCALE, joint='curve')
    radius = width*SCALE/2
    # Round every sampled join to avoid hairline gaps in Pillow's wide polylines.
    for x, y in points:
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=color)

def make(transparent=False):
    image = Image.new('RGBA', (512*SCALE, 512*SCALE), (0, 0, 0, 0) if transparent else FOREST)
    draw = ImageDraw.Draw(image)
    color = '#FFFFFF' if transparent else CREAM
    stroke(draw, [(256*SCALE, 347*SCALE), (256*SCALE, 247*SCALE)], color, 17)
    stroke(draw, curve((256,247),(254,203),(283,170),(340,163)) + curve((340,163),(341,220),(310,257),(256,261)), color, 17)
    stroke(draw, curve((256,289),(208,288),(172,259),(170,205)) + curve((170,205),(222,205),(254,234),(256,273)), color, 17)
    stroke(draw, curve((216,348),(241,337),(273,337),(297,348)), '#FFFFFF' if transparent else GOLD, 13)
    return image

OUT.mkdir(parents=True, exist_ok=True)
icon = make()
for filename, size in [('icon-192.png',192), ('icon-512.png',512), ('icon-maskable-512.png',512), ('apple-touch-icon.png',180)]:
    icon.resize((size,size), Image.Resampling.LANCZOS).convert('RGB').save(OUT / filename, optimize=True)
make(True).resize((96,96), Image.Resampling.LANCZOS).save(OUT / 'badge-96.png', optimize=True)
print('Rahmat icons generated.')
