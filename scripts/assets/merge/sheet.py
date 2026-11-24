"""Contact sheet for eyeballing seed imagery.

Usage: python3 -I scripts/assets/merge/sheet.py OUT.jpg COLS CELL_W CELL_H FILE [FILE ...]
Each file is fitted into a CELL_W x CELL_H cell (letterboxed) with its file name underneath.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

out, cols, cw, ch, *files = sys.argv[1:]
cols, cw, ch = int(cols), int(cw), int(ch)
label = 18
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * (ch + label)), "#ddd")
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    im.thumbnail((cw - 6, ch - 6))
    x, y = (i % cols) * cw, (i // cols) * (ch + label)
    sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
    draw.text((x + 4, y + ch + 2), Path(f).stem[:48], fill="#000")
sheet.save(out, quality=85)
print(out, sheet.size)
