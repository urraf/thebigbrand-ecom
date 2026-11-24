"""Zoomed views of the four corner regions with a fine grid (orig coords): corners.py src out.png ulx uly urx ury llx lly lrx lry [r=160]"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
src, out = sys.argv[1], sys.argv[2]
pts = [int(v) for v in sys.argv[3:11]]
r = int(sys.argv[11]) if len(sys.argv) > 11 else 160
im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
tiles = []
for i in range(4):
    cx, cy = pts[2 * i], pts[2 * i + 1]
    box = (cx - r, cy - r, cx + r, cy + r)
    t = im.crop(box).resize((320, 320))
    d = ImageDraw.Draw(t)
    s = 320 / (2 * r)
    step = 20
    for x in range((box[0] // step + 1) * step, box[2], step):
        X = (x - box[0]) * s
        d.line([(X, 0), (X, 320)], fill=(255, 0, 255) if x % 100 == 0 else (0, 220, 255))
        if x % 100 == 0: d.text((X + 2, 2), str(x), fill=(255, 0, 255), font=f)
    for y in range((box[1] // step + 1) * step, box[3], step):
        Y = (y - box[1]) * s
        d.line([(0, Y), (320, Y)], fill=(255, 0, 255) if y % 100 == 0 else (0, 220, 255))
        if y % 100 == 0: d.text((2, Y + 2), str(y), fill=(255, 0, 255), font=f)
    d.text((4, 300), ["UL", "UR", "LL", "LR"][i], fill=(255, 0, 0), font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16))
    tiles.append(t)
sheet = Image.new("RGB", (640, 640))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % 2) * 320, (i // 2) * 320))
sheet.save(out)
