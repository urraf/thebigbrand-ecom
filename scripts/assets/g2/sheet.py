#!/usr/bin/env python3
"""Contact sheets for visual curation.

  sheet.py raw  [cols] [rows] [tile]          -> sheets of every downloaded raw candidate
  sheet.py codes <out-name> <code> [<code>..] -> one sheet of the given raw codes (larger tiles)
  sheet.py out  <out-name>                    -> sheet of processed outputs in public/media/products/<g2 brands>
Sheets are written to .shots/assets-raw/g2/sheets/.
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g2")
OUT = os.path.join(RAW, "sheets")
os.makedirs(OUT, exist_ok=True)
BRANDS = ["himalaya", "biotique", "parachute", "mamaearth", "plum"]

try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 15)
except Exception:
    FONT = ImageFont.load_default()


def tile(path, label, tw, th):
    t = Image.new("RGB", (tw, th + 40), "#e9e9e9")
    try:
        im = Image.open(path)
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        info = f"{w}x{h}"
        im.thumbnail((tw - 6, th - 6))
        t.paste(im, ((tw - im.size[0]) // 2, (th - im.size[1]) // 2))
    except Exception:
        info = "unreadable"
    d = ImageDraw.Draw(t)
    d.text((4, th + 2), label[:38], fill="black", font=FONT)
    d.text((4, th + 20), info, fill="#555", font=FONT)
    return t


def build(items, name, cols, rows, tw, th):
    per = cols * rows
    paths = []
    for s in range(0, len(items), per):
        chunk = items[s:s + per]
        sheet = Image.new("RGB", (cols * tw, ((len(chunk) + cols - 1) // cols) * (th + 40)), "white")
        for i, (p, lab) in enumerate(chunk):
            sheet.paste(tile(p, lab, tw, th), ((i % cols) * tw, (i // cols) * (th + 40)))
        out = os.path.join(OUT, f"{name}_{s // per + 1:02d}.jpg")
        sheet.save(out, quality=85)
        paths.append(out)
    return paths


def main():
    a = sys.argv[1:]
    mode = a[0]
    if mode == "raw":
        cols = int(a[1]) if len(a) > 1 else 5
        rows = int(a[2]) if len(a) > 2 else 4
        tw = int(a[3]) if len(a) > 3 else 240
        cands = json.load(open(os.path.join(RAW, "candidates.json")))
        items = []
        for c in cands:
            p = os.path.join(RAW, "img", c["code"] + ".jpg")
            if os.path.exists(p):
                items.append((p, f"{c['code'][-6:]} {c['brand'][:4]} {c['name'][:24]}"))
        paths = build(items, "raw", cols, rows, tw, int(tw * 1.25))
    elif mode == "codes":
        name = a[1]
        cands = {c["code"]: c for c in json.load(open(os.path.join(RAW, "candidates.json")))}
        items = []
        for code in a[2:]:
            p = os.path.join(RAW, "img", code + ".jpg")
            c = cands.get(code, {"name": "", "brand": ""})
            items.append((p, f"{code[-6:]} {c['name'][:28]}"))
        paths = build(items, name, 4, 2, 360, 450)
    elif mode == "alt":
        # alt <name> <code-prefix filter...>: every alternate raw photo fetched by alts.py
        name = a[1]
        pre = tuple(a[2:]) or ("",)
        files = sorted(glob.glob(os.path.join(RAW, "alt", "*.jpg")))
        items = [(f, os.path.basename(f)[:-4][-9:]) for f in files if os.path.basename(f).startswith(pre)]
        paths = build(items, name, 8, 4, 180, 225)
    elif mode == "final":
        name = a[1]
        items = [(os.path.join(RAW, "work", f"{c}_final.png"), c[-6:]) for c in a[2:]]
        paths = build(items, name, 4, 2, 360, 450)
    elif mode == "out":
        name = a[1]
        items = []
        for b in BRANDS:
            for p in sorted(glob.glob(os.path.join(ROOT, "public", "media", "products", b, "*.webp"))):
                items.append((p, f"{b[:5]}/{os.path.basename(p)[:-5]}"))
        paths = build(items, name, 6, 3, 220, 275)
    print("\n".join(paths))


if __name__ == "__main__":
    main()
