"""Overlay a labelled pixel grid (original-image coordinates) for picking crop/quad points.
grid.py <src> <out.png> [view_max=900] [step=100]"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
src, out = sys.argv[1], sys.argv[2]
vmax = int(sys.argv[3]) if len(sys.argv) > 3 else 900
step = int(sys.argv[4]) if len(sys.argv) > 4 else 100
im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
W, H = im.size
s = min(vmax / W, vmax / H)
v = im.resize((int(W * s), int(H * s)))
d = ImageDraw.Draw(v)
f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
for x in range(0, W, step):
    d.line([(x * s, 0), (x * s, v.height)], fill=(255, 0, 255) if x % (step * 5) == 0 else (0, 200, 255), width=1)
    d.text((x * s + 2, 2), str(x), fill=(255, 0, 255), font=f)
for y in range(0, H, step):
    d.line([(0, y * s), (v.width, y * s)], fill=(255, 0, 255) if y % (step * 5) == 0 else (0, 200, 255), width=1)
    d.text((2, y * s + 2), str(y), fill=(255, 0, 255), font=f)
v.save(out)
print(W, H, "->", v.size)
