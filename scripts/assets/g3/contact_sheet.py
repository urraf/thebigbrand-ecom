"""Build labelled contact sheets from images for visual review.

Usage: python3 -I contact_sheet.py <out_prefix> <cols> <per_sheet> <img> [<img> ...]
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

out, cols, per = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
CW, CH, LH = 300, 300, 26
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
except Exception:
    font = ImageFont.load_default()
for s in range(0, len(files), per):
    chunk = files[s:s + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * CW, rows * (CH + LH)), "white")
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x, y = (i % cols) * CW, (i // cols) * (CH + LH)
        try:
            im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
            w, h = im.size
            im.thumbnail((CW - 6, CH - 6))
            sheet.paste(im, (x + (CW - im.width) // 2, y + (CH - im.height) // 2))
            label = "%s %dx%d" % (os.path.basename(f).split(".")[0], w, h)
        except Exception as e:
            label = "ERR " + os.path.basename(f)
        d.rectangle([x, y + CH, x + CW - 1, y + CH + LH - 1], fill="#222")
        d.text((x + 4, y + CH + 4), label, fill="white", font=font)
    path = "%s-%02d.jpg" % (out, s // per + 1)
    sheet.save(path, quality=85)
    print(path)
