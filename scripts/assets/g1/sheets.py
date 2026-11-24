"""Build labelled contact sheets of downloaded candidate images for visual screening.

Usage: python3 -I sheets.py <brand> [--cols 5] [--rows 4] [--cell 260] [--suffix .400.jpg] [--codes a,b,c] [--name tag]
Sheets land in .shots/assets-raw/g1/sheets/<name>-NN.png; index map in sheets/<name>.json.
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf  # noqa: E402

FONT = "/System/Library/Fonts/Helvetica.ttc"


def white_score(path):
    """Share of border pixels that are light & neutral (clean packshot backgrounds score high)."""
    import numpy as np
    try:
        im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    except Exception:
        return 0.0
    im.thumbnail((200, 200))
    a = np.asarray(im).astype(int)
    k = 6
    b = np.concatenate([a[:k].reshape(-1, 3), a[-k:].reshape(-1, 3), a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3)])
    ok = (b.min(axis=1) > 200) & ((b.max(axis=1) - b.min(axis=1)) < 25)
    return float(ok.mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brand")
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--rows", type=int, default=4)
    ap.add_argument("--cell", type=int, default=260)
    ap.add_argument("--suffix", default=".400.jpg")
    ap.add_argument("--codes", default="")
    ap.add_argument("--name", default="")
    ap.add_argument("--sort", default="", help="'white' = cleanest (white-border) photos first")
    ap.add_argument("--min-white", type=float, default=-1)
    a = ap.parse_args()
    sl = json.load(open(os.path.join(obf.RAW, "shortlist.json")))
    cands = json.load(open(os.path.join(obf.RAW, "candidates.json")))
    if a.codes:
        codes = [c for c in a.codes.split(",") if c]
    else:
        codes = [c for c, p in sl.items() if p["_b"] == a.brand]
        codes.sort(key=lambda c: ("en:india" not in (sl[c].get("countries_tags") or []), (sl[c].get("product_name") or "")))
    codes = [c for c in codes if os.path.exists(os.path.join(obf.IMG_DIR, c + a.suffix))]
    if a.sort == "white" or a.min_white >= 0:
        sc = {c: white_score(os.path.join(obf.IMG_DIR, c + a.suffix)) for c in codes}
        codes = [c for c in codes if sc[c] >= a.min_white]
        if a.sort == "white":
            codes.sort(key=lambda c: -sc[c])
    name = a.name or a.brand
    out = os.path.join(obf.RAW, "sheets")
    os.makedirs(out, exist_ok=True)
    f_big = ImageFont.truetype(FONT, 22)
    f_small = ImageFont.truetype(FONT, 13)
    per = a.cols * a.rows
    labh = 44
    index = {}
    for s in range(0, len(codes), per):
        chunk = codes[s:s + per]
        W = a.cols * a.cell
        H = a.rows * (a.cell + labh)
        sheet = Image.new("RGB", (W, H), (235, 235, 235))
        d = ImageDraw.Draw(sheet)
        for i, code in enumerate(chunk):
            n = s + i
            index[n] = code
            x = (i % a.cols) * a.cell
            y = (i // a.cols) * (a.cell + labh)
            try:
                im = Image.open(os.path.join(obf.IMG_DIR, code + a.suffix))
                im = ImageOps.exif_transpose(im).convert("RGB")
                w0, h0 = im.size
                im.thumbnail((a.cell - 8, a.cell - 8))
                sheet.paste(im, (x + (a.cell - im.width) // 2, y + (a.cell - im.height) // 2))
            except Exception as e:  # noqa
                w0 = h0 = 0
                d.text((x + 10, y + 10), "ERR", fill=(200, 0, 0), font=f_big)
            p = cands.get(code, {})
            nm = (p.get("product_name_en") or p.get("product_name") or "")[:34]
            d.rectangle([x, y + a.cell, x + a.cell - 1, y + a.cell + labh - 1], fill=(255, 255, 255))
            d.text((x + 4, y + a.cell + 2), f"#{n}", fill=(200, 0, 60), font=f_big)
            d.text((x + 60, y + a.cell + 2), f"{w0}x{h0}", fill=(90, 90, 90), font=f_small)
            d.text((x + 4, y + a.cell + 26), nm, fill=(20, 20, 20), font=f_small)
            d.rectangle([x, y, x + a.cell - 1, y + a.cell + labh - 1], outline=(180, 180, 180))
        sheet.save(os.path.join(out, f"{name}-{s // per:02d}.png"))
    json.dump(index, open(os.path.join(out, f"{name}.json"), "w"), indent=1)
    print(name, len(codes), "images,", (len(codes) + per - 1) // per, "sheets")


if __name__ == "__main__":
    main()
