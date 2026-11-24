"""Montage arbitrary image files for visual QA: montage.py out.png cols cellw file1 file2 ..."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ch = int(cw * 1.25)
lab = 22
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * (ch + lab)), (200, 200, 205))
d = ImageDraw.Draw(sheet)
f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
for i, p in enumerate(files):
    x, y = (i % cols) * cw, (i // cols) * (ch + lab)
    im = Image.open(p).convert("RGB")
    im.thumbnail((cw - 6, ch - 6))
    sheet.paste(im, (x + 3, y + 3))
    d.text((x + 4, y + ch + 2), os.path.basename(p)[:40], fill=(0, 0, 0), font=f)
sheet.save(out)
print(out, sheet.size)
