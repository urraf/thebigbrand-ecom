"""Review sheet of built packshots (grey frame so the white canvas edge is visible).
Usage: python3 -I review_sheet.py <out_prefix> <per_sheet> <webp> [<webp> ...]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
out, per, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
CW, CH = 360, 450
cols = 5
for s in range(0, len(files), per):
    ch = files[s:s + per]
    rows = (len(ch) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (CW + 10), rows * (CH + 30)), (200, 200, 200))
    d = ImageDraw.Draw(sheet)
    for i, fn in enumerate(ch):
        im = Image.open(fn).convert("RGB").resize((CW, CH), Image.LANCZOS)
        x, y = (i % cols) * (CW + 10) + 5, (i // cols) * (CH + 30) + 25
        sheet.paste(im, (x, y))
        d.text((x, y - 20), os.path.basename(os.path.dirname(fn)) + "/" + os.path.basename(fn)[:40], fill="black", font=f)
    p = "%s-%02d.jpg" % (out, s // per + 1)
    sheet.save(p, quality=88)
    print(p)
