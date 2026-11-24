"""g3 packshot pipeline: Open Beauty Facts photo -> clean 1000x1250 white WEBP packshot.

Steps per item (config in items.json):
  1. load + EXIF auto-orient, optional rotate (deg, CCW) and crop box (fractions x0,y0,x1,y1)
  2. Apple Vision foreground mask (lift binary, on-device) unless mode == "rect"
  3. optional polygon (fractions of the cropped image) intersected with the mask to drop hands/clutter
  4. light tone correction (auto-levels on product pixels), composite on #ffffff
  5. trim to product, fit inside 1000x1250 with ~6% margin, centre, save WEBP q82

One-time setup (macOS, on-device Vision, no downloads):
  swiftc -O scripts/assets/g3/lift.swift -o .shots/assets-raw/g3/lift
Full rebuild from scratch:
  obf_search.py / obf_product.py / obf_download.py (polite OBF fetch) -> process.py prep -> process.py build
  -> build_catalog.py (writes prisma/seed-data/catalog/g3.json)

Usage:
  python3 -I process.py prep  [key ...]   # crop + Vision mask -> .shots/assets-raw/g3/work
  python3 -I process.py build [key ...]   # compose -> public/media/products/<brand>/<slug>.webp
  python3 -I process.py grid  <key>       # coordinate grid overlay of the cropped source for picking polygons
"""
import json, math, os, subprocess, sys
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageChops, ImageEnhance, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g3")
WORK = os.path.join(RAW, "work")
LIFT = os.path.join(RAW, "lift")          # compiled from lift.swift
MEDIA = os.path.join(ROOT, "public", "media", "products")
W, H = 1000, 1250
MAXSIDE = 2600

Image.MAX_IMAGE_PIXELS = None


def items():
    return json.load(open(os.path.join(HERE, "items.json")))


def load_src(it):
    im = ImageOps.exif_transpose(Image.open(os.path.join(RAW, "img", it["src"]))).convert("RGB")
    if it.get("rotate"):
        im = im.rotate(it["rotate"], resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    if it.get("crop"):
        x0, y0, x1, y1 = it["crop"]
        im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    if max(im.size) > MAXSIDE:
        s = MAXSIDE / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im


def prep(it):
    key = it["key"]
    im = load_src(it)
    src = os.path.join(WORK, key + ".png")
    im.save(src)
    if it.get("mode") == "rect":
        return
    mpath = os.path.join(WORK, key + ".mask.png")
    out = subprocess.run([LIFT, src, mpath, str(it.get("instance", "all"))], capture_output=True, text=True)
    print(key, out.stdout.strip(), out.stderr.strip()[:200])


def poly_mask(size, pts):
    if isinstance(pts, dict) and "ellipse" in pts:
        cx, cy, rx, ry = pts["ellipse"]
        pts = [(cx + rx * math.cos(t * math.pi / 90), cy + ry * math.sin(t * math.pi / 90)) for t in range(180)]
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon([(x * size[0], y * size[1]) for x, y in pts], fill=255)
    return m


def build(it):
    key = it["key"]
    im = Image.open(os.path.join(WORK, key + ".png")).convert("RGB")
    if it.get("mode") == "rect":
        mask = Image.new("L", im.size, 255)
    else:
        mask = Image.open(os.path.join(WORK, key + ".mask.png")).convert("L").resize(im.size, Image.LANCZOS)
    for poly in it.get("polys", []):
        mask = ImageChops.multiply(mask, poly_mask(im.size, poly))
    for poly in it.get("cut", []):          # explicit regions to remove
        mask = ImageChops.subtract(mask, poly_mask(im.size, poly))
    if it.get("add"):                        # explicit regions to force-keep
        for poly in it["add"]:
            mask = ImageChops.lighter(mask, poly_mask(im.size, poly))
    if it.get("despeckle", True):
        mask = despeckle(mask)
    # clean edges: binarise softly, remove speckles, slight feather
    mask = mask.point(lambda v: 0 if v < 40 else (255 if v > 215 else v))
    mask = mask.filter(ImageFilter.MedianFilter(5))
    if it.get("erode"):
        mask = mask.filter(ImageFilter.MinFilter(it["erode"]))
    mask = mask.filter(ImageFilter.GaussianBlur(it.get("feather", 1.2)))
    bbox = mask.point(lambda v: 255 if v > 30 else 0).getbbox()
    if not bbox:
        print("EMPTY MASK", key); return
    im, mask = im.crop(bbox), mask.crop(bbox)

    # tone: auto-levels computed on product pixels only, then gentle brightness/contrast/saturation
    hard = mask.point(lambda v: 255 if v > 128 else 0)
    if it.get("levels", True):
        im = autolevel(im, hard, it.get("cutoff", 0.6))
    if it.get("bright"):
        im = ImageEnhance.Brightness(im).enhance(it["bright"])
    if it.get("contrast"):
        im = ImageEnhance.Contrast(im).enhance(it["contrast"])
    if it.get("sat"):
        im = ImageEnhance.Color(im).enhance(it["sat"])

    # fit inside the canvas with ~6% margin
    mx, my = int(W * it.get("margin", 0.06)), int(H * it.get("margin", 0.06))
    s = min((W - 2 * mx) / im.width, (H - 2 * my) / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    mask = mask.resize((nw, nh), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=it.get("sharpen", 55), threshold=2))
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(im, ((W - nw) // 2, (H - nh) // 2), mask)
    outdir = os.path.join(MEDIA, it["brand"])
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, it["slug"] + ".webp")
    canvas.save(out, "WEBP", quality=82, method=6)
    print("built", os.path.relpath(out, ROOT), "%dx%d from %dx%d" % (W, H, *bbox[2:]))


def despeckle(mask, frac=0.03):
    """Drop disconnected mask fragments smaller than `frac` of the largest one (stray fabric, crumbs)."""
    sc = 4
    small = mask.resize((max(1, mask.width // sc), max(1, mask.height // sc))).point(lambda v: 255 if v > 100 else 0)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] and not seen[y0 * w + x0]:
                stack, pts = [(x0, y0)], []
                seen[y0 * w + x0] = 1
                while stack:
                    x, y = stack.pop()
                    pts.append((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
                comps.append(pts)
    if len(comps) <= 1:
        return mask
    big = max(len(c) for c in comps)
    kill = Image.new("L", (w, h), 0)
    kp = kill.load()
    for c in comps:
        if len(c) < big * frac:
            for x, y in c:
                kp[x, y] = 255
    kill = kill.filter(ImageFilter.MaxFilter(3)).resize(mask.size)
    return ImageChops.subtract(mask, kill)


def autolevel(im, mask, cutoff):
    """Per-channel-linked levels stretch measured on the masked (product) pixels."""
    lum = im.convert("L")
    hist = lum.histogram(mask)
    total = sum(hist)
    if total < 100:
        return im
    lo_n, hi_n = total * cutoff / 100, total * (1 - cutoff / 100)
    acc, lo, hi = 0, 0, 255
    for i, c in enumerate(hist):
        acc += c
        if acc >= lo_n:
            lo = i; break
    acc = 0
    for i, c in enumerate(hist):
        acc += c
        if acc >= hi_n:
            hi = i; break
    lo = min(lo, 40)          # never crush more than a little
    hi = max(hi, 200)
    if hi - lo < 50:
        return im
    scale = 255.0 / (hi - lo)
    lut = [max(0, min(255, round((i - lo) * scale))) for i in range(256)]
    return im.point(lut * 3)


def grid(it):
    im = load_src(it)
    s = 900 / im.height
    im = im.resize((round(im.width * s), 900))
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    except Exception:
        f = ImageFont.load_default()
    for i in range(1, 20):
        x = im.width * i / 20; y = im.height * i / 20
        col = (255, 0, 0) if i % 2 == 0 else (0, 200, 255)
        d.line([(x, 0), (x, im.height)], fill=col, width=1)
        d.line([(0, y), (im.width, y)], fill=col, width=1)
        if i % 2 == 0:
            d.text((x + 2, 2), "%.1f" % (i / 20), fill=(255, 0, 0), font=f)
            d.text((2, y + 2), "%.1f" % (i / 20), fill=(255, 0, 0), font=f)
    out = os.path.join(WORK, it["key"] + ".grid.jpg")
    im.save(out, quality=85)
    print(out)


def preview(it):
    key = it["key"]
    im = Image.open(os.path.join(WORK, key + ".png")).convert("RGB")
    mask = Image.open(os.path.join(WORK, key + ".mask.png")).convert("L").resize(im.size) if it.get("mode") != "rect" else Image.new("L", im.size, 255)
    for poly in it.get("polys", []):
        mask = ImageChops.multiply(mask, poly_mask(im.size, poly))
    for poly in it.get("cut", []):
        mask = ImageChops.subtract(mask, poly_mask(im.size, poly))
    s = 600 / im.height
    im = im.resize((round(im.width * s), 600)); mask = mask.resize(im.size)
    bg = Image.new("RGB", im.size, (120, 200, 120))
    bg.paste(im, (0, 0), mask)
    pair = Image.new("RGB", (im.width * 2 + 10, 600), "white")
    pair.paste(im, (0, 0)); pair.paste(bg, (im.width + 10, 0))
    pair.save(os.path.join(WORK, key + ".prev.jpg"), quality=80)


def main():
    os.makedirs(WORK, exist_ok=True)
    cmd, keys = sys.argv[1], set(sys.argv[2:])
    for it in items():
        if keys and it["key"] not in keys:
            continue
        if it.get("skip") and not keys:
            continue
        {"prep": prep, "build": build, "grid": grid, "preview": preview}[cmd](it)


if __name__ == "__main__":
    main()
