#!/usr/bin/env python3
"""Turn an accepted Open Beauty Facts photo into a clean 1000x1250 white-background packshot.

Steps per image:
  1. auto-orient (EXIF), optional manual rotation / pre-crop, downscale to <= 2400 px
  2. cut the product out of its background with Apple Vision (bin/lift, built from lift.swift)
  3. trim to the product, pad onto a 4:5 pure-white canvas with ~6% margin, save WEBP q82

  process.py try  <code> [--rot 90] [--inst 1,2] [--crop l,t,r,b] [--nocut] [--noenh] [--deskew]  -> work/<code>_final.png (preview)
  process.py out  <code> <brand> <slug> [same flags]                           -> public/media/products/<brand>/<slug>.webp
"""
import os
import subprocess
import sys

from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g2")
WORK = os.path.join(RAW, "work")
LIFT = os.path.join(RAW, "bin", "lift")
MEDIA = os.path.join(ROOT, "public", "media", "products")
W, H = 1000, 1250
MARGIN = 0.06
os.makedirs(WORK, exist_ok=True)


def prep(code, rot=0, crop=None):
    im = Image.open(os.path.join(RAW, "img", f"{code}.jpg"))
    im = ImageOps.exif_transpose(im).convert("RGB")
    if crop:  # fractions l,t,r,b of the oriented image
        w, h = im.size
        l, t, r, b = crop
        im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    if rot:
        im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    im.thumbnail((2400, 2400), Image.LANCZOS)
    path = os.path.join(WORK, f"{code}_prep.png")
    im.save(path)
    return path


def cut(code, prep_path, inst="all"):
    out = os.path.join(WORK, f"{code}_cut.png")
    r = subprocess.run([LIFT, prep_path, out, inst], capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0 or not os.path.exists(out):
        raise SystemExit(f"cut failed for {code}: {r.stderr}")
    return out


def levels(im, cap=1.22):
    """Gentle per-channel white point: lift the brightest product pixels towards white.

    Phone photos shot under room light come out grey/yellow; on a pure-white canvas that looks
    muddy. Only the product pixels (alpha > 200) are measured; gain is capped so colours stay true.
    """
    import numpy as np
    a = np.asarray(im).astype(np.float32)
    mask = a[..., 3] > 200
    if mask.sum() < 500:
        return im
    rgb = a[..., :3]
    px = rgb[mask]
    p = np.percentile(px, 99.3, axis=0)
    gains = np.clip(250.0 / np.maximum(p, 1), 1.0, cap)
    # keep the white balance correction modest: limit channel spread to 8%
    g_min = gains.min()
    gains = np.minimum(gains, g_min * 1.08)
    # lift shadows a touch less than highlights (mild contrast-preserving curve)
    out = rgb * gains
    a[..., :3] = np.clip(out, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def keep_main(im):
    """Drop stray background specks: keep only the connected blob that holds the product centre."""
    from PIL import ImageDraw
    import numpy as np
    alpha = im.split()[-1]
    small = alpha.resize((max(1, im.width // 4), max(1, im.height // 4)))
    b = small.point(lambda a: 255 if a > 100 else 0)
    arr = np.asarray(b)
    ys, xs = np.nonzero(arr)
    if len(xs) == 0:
        return im
    cy, cx = int(np.median(ys)), int(np.median(xs))
    if arr[cy, cx] == 0:  # centre not opaque: start from the opaque pixel closest to it
        i = int(np.argmin((ys - cy) ** 2 + (xs - cx) ** 2))
        cy, cx = int(ys[i]), int(xs[i])
    ImageDraw.floodfill(b, (cx, cy), 128)
    keep = b.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5)).resize(im.size)
    from PIL import ImageChops
    im = im.copy()
    im.putalpha(ImageChops.multiply(alpha, keep))
    return im


def compose(src_rgba, enhance=True, erode=5, main_only=True):
    im = src_rgba.convert("RGBA")
    if main_only:
        im = keep_main(im)
    if enhance:
        im = levels(im)
    alpha = im.split()[-1]
    # drop faint halo pixels, shave a 1-2 px rim (removes dark background fringe left by the
    # cut-out on phone photos) and soften the edge slightly, then trim to the product
    alpha = alpha.point(lambda a: 0 if a < 24 else a)
    if erode:
        alpha = alpha.filter(ImageFilter.MinFilter(erode)).filter(ImageFilter.GaussianBlur(0.7))
    bbox = alpha.getbbox()
    im.putalpha(alpha)
    im = im.crop(bbox)
    aw, ah = W * (1 - 2 * MARGIN), H * (1 - 2 * MARGIN)
    scale = min(aw / im.width, ah / im.height)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    if scale > 1.05:  # upscaled: a touch of sharpening keeps labels crisp
        rgb = im.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        rgb.putalpha(im.split()[-1])
        im = rgb
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(im, ((W - nw) // 2, (H - nh) // 2), im)
    return canvas, scale


def tilt(rgba):
    """Angle (degrees) by which the product's long axis leans from vertical, from mask moments.
    Positive = top leans left (fix by rotating clockwise, i.e. PIL rotate(-angle))."""
    import math
    import numpy as np
    a = np.asarray(rgba.split()[-1].resize((rgba.width // 4 or 1, rgba.height // 4 or 1))) > 128
    ys, xs = np.nonzero(a)
    if len(xs) < 50:
        return 0.0
    x, y = xs - xs.mean(), ys - ys.mean()
    mu20, mu02, mu11 = (x * x).mean(), (y * y).mean(), (x * y).mean()
    theta = 0.5 * math.degrees(math.atan2(2 * mu11, mu20 - mu02))  # major axis vs +x (y down)
    lean = theta - 90 if theta > 0 else theta + 90
    return -lean


def run(code, rot=0, inst="all", crop=None, nocut=False, noenh=False, deskew=False):
    p = prep(code, rot, crop)
    if nocut:
        src = Image.open(p).convert("RGBA")
    else:
        src = Image.open(cut(code, p, inst))
    t = tilt(src)
    print(f"{code}: estimated lean {t:+.1f} deg")
    if deskew and 0.8 < abs(t) < 15:
        src = src.rotate(-t, expand=True, resample=Image.BICUBIC)
    canvas, scale = compose(src, enhance=not noenh, erode=0 if nocut else 5)
    print(f"{code}: product scaled x{scale:.2f}")
    return canvas


def parse(argv):
    o = {"rot": 0, "inst": "all", "crop": None, "nocut": False, "noenh": False, "deskew": False}
    rest = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--rot":
            o["rot"] = float(argv[i + 1]); i += 2
        elif a == "--inst":
            o["inst"] = argv[i + 1]; i += 2
        elif a == "--crop":
            o["crop"] = tuple(float(x) for x in argv[i + 1].split(",")); i += 2
        elif a == "--deskew":
            o["deskew"] = True; i += 1
        elif a == "--noenh":
            o["noenh"] = True; i += 1
        elif a == "--nocut":
            o["nocut"] = True; i += 1
        else:
            rest.append(a); i += 1
    return rest, o


if __name__ == "__main__":
    rest, o = parse(sys.argv[1:])
    mode = rest[0]
    if mode == "try":
        code = rest[1]
        c = run(code, **o)
        out = os.path.join(WORK, f"{code}_final.png")
        c.save(out)
        print(out)
    elif mode == "out":
        code, brand, slug = rest[1], rest[2], rest[3]
        c = run(code, **o)
        d = os.path.join(MEDIA, brand)
        os.makedirs(d, exist_ok=True)
        out = os.path.join(d, f"{slug}.webp")
        c.save(out, "WEBP", quality=82, method=6)
        print(out, os.path.getsize(out) // 1024, "KB")
