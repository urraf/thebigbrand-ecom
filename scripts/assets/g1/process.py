"""Turn an accepted Open Beauty Facts photo into a clean 1000x1250 packshot (WEBP q82).

Steps: EXIF auto-orient -> optional rotate/crop -> white-balance on the background
-> remove the light, border-connected background (feathered) -> trim -> fit into the
4:5 canvas on pure white with ~6% margin -> mild sharpen -> WEBP.

Usage as a library: process(src, dest, crop=None, rotate=0, bg="auto", tol=26)
CLI: python3 -I process.py src.jpg out.webp [--crop l,t,r,b] [--rotate deg] [--bg auto|keep|white]
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageFilter, ImageOps

CANVAS = (1000, 1250)
MARGIN_X, MARGIN_Y = 60, 75  # ~6% of width / height


def _load(src):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        base = Image.new("RGBA", im.size, (255, 255, 255, 255))
        base.alpha_composite(im)
        im = base
    return im.convert("RGB")


def _border(a, frac=0.02):
    h, w = a.shape[:2]
    k = max(2, int(min(h, w) * frac))
    return np.concatenate([a[:k].reshape(-1, 3), a[-k:].reshape(-1, 3), a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3)])


def _flood(cand):
    """Pixels of boolean mask `cand` connected to the image border (4-connectivity)."""
    reach = np.zeros_like(cand)
    reach[0, :] = cand[0, :]
    reach[-1, :] = cand[-1, :]
    reach[:, 0] = cand[:, 0]
    reach[:, -1] = cand[:, -1]
    # iterate dilation at low cost: work on a half-res copy first, then refine at full res
    for _ in range(4000):
        grown = reach.copy()
        grown[1:, :] |= reach[:-1, :]
        grown[:-1, :] |= reach[1:, :]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= cand
        if np.array_equal(grown, reach):
            break
        # big jumps: propagate along rows/cols where candidate runs are contiguous
        reach = grown
    return reach


def _flood_fast(cand):
    small_scale = 3
    h, w = cand.shape
    if h * w > 600_000:
        hs, ws = h // small_scale, w // small_scale
        cs = cand[: hs * small_scale, : ws * small_scale].reshape(hs, small_scale, ws, small_scale).all(axis=(1, 3))
        rs = _flood(cs)
        seed = np.repeat(np.repeat(rs, small_scale, 0), small_scale, 1)
        full = np.zeros_like(cand)
        full[: seed.shape[0], : seed.shape[1]] = seed
        full &= cand
        # refine: grow from the coarse seed at full resolution
        full[0, :] |= cand[0, :]
        full[-1, :] |= cand[-1, :]
        full[:, 0] |= cand[:, 0]
        full[:, -1] |= cand[:, -1]
        for _ in range(60):
            g = full.copy()
            g[1:, :] |= full[:-1, :]
            g[:-1, :] |= full[1:, :]
            g[:, 1:] |= full[:, :-1]
            g[:, :-1] |= full[:, 1:]
            g &= cand
            if np.array_equal(g, full):
                break
            full = g
        return full
    return _flood(cand)


def _largest_component(fg):
    """Keep the largest 8-connected foreground blob (computed on a small copy, BFS)."""
    h, w = fg.shape
    k = max(1, int(max(h, w) / 220))
    small = fg[: h - h % k, : w - w % k].reshape(h // k, k, w // k, k).mean(axis=(1, 3)) > 0.3
    sh, sw = small.shape
    lab = np.zeros((sh, sw), dtype=np.int32)
    best, best_n, cur = 0, 0, 0
    for y in range(sh):
        for x in range(sw):
            if small[y, x] and not lab[y, x]:
                cur += 1
                stack = [(y, x)]
                lab[y, x] = cur
                n = 0
                while stack:
                    cy, cx = stack.pop()
                    n += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < sh and 0 <= nx < sw and small[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = cur
                                stack.append((ny, nx))
                if n > best_n:
                    best, best_n = cur, n
    if not best:
        return fg
    keep = (lab == best)
    keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).resize((w - w % k, h - h % k), Image.NEAREST)) > 0
    full = np.zeros_like(fg)
    full[: keep.shape[0], : keep.shape[1]] = keep
    return fg & full


def _kmeans(x, k, iters=12, seed=0):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), size=min(k, len(x)), replace=False)].copy()
    for _ in range(iters):
        d = ((x[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for j in range(len(c)):
            pts = x[lab == j]
            if len(pts):
                c[j] = pts.mean(0)
    return c


def _fill_holes(fg):
    """Foreground plus every region not connected to the border through background."""
    return ~_flood_fast(~fg)


def _kmeans_mask(a, center=(0.3, 0.2, 0.7, 0.8), kb=5, kf=7, sep=28.0, bias=0.9, opening=3):
    """GrabCut-lite: colour models from the border (background) and a central box (product)."""
    h, w = a.shape[:2]
    sc = 640.0 / max(h, w)
    small = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((max(1, int(w * sc)), max(1, int(h * sc))), Image.BILINEAR)).astype(np.float32)
    sh, sw = small.shape[:2]
    b = max(2, int(min(sh, sw) * 0.05))
    border = np.concatenate([small[:b].reshape(-1, 3), small[-b:].reshape(-1, 3), small[:, :b].reshape(-1, 3), small[:, -b:].reshape(-1, 3)])
    l, t, r, bt = center
    core = small[int(t * sh):int(bt * sh), int(l * sw):int(r * sw)].reshape(-1, 3)
    cb = _kmeans(border, kb)
    cf = _kmeans(core, kf, seed=1)
    keep = np.sqrt(((cf[:, None, :] - cb[None, :, :]) ** 2).sum(-1)).min(1) > sep
    cf = cf[keep] if keep.any() else cf
    flat = small.reshape(-1, 3)
    db = np.sqrt(((flat[:, None, :] - cb[None]) ** 2).sum(-1)).min(1)
    df = np.sqrt(((flat[:, None, :] - cf[None]) ** 2).sum(-1)).min(1)
    fg = (df < db * bias).reshape(sh, sw)
    m = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(opening)).filter(ImageFilter.MaxFilter(opening))
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    fg = np.asarray(m) > 127
    fg = _largest_component(fg)
    fg = _fill_holes(fg)
    big = Image.fromarray((fg * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(1.0, 1.2 / sc / 3)))
    return np.asarray(big).astype(np.float32) / 255.0


def _shape_mask(shapes, W, H, ds, blur=0.8):
    """Union of {"ellipse"|"rect"(+radius)|"poly"} primitives in source px -> soft mask (0..1), supersampled."""
    from PIL import ImageDraw
    ss = 3
    mk = Image.new("L", (W * ss, H * ss), 0)
    dr = ImageDraw.Draw(mk)
    f = ds * ss
    for sh in shapes:
        if "ellipse" in sh:
            dr.ellipse([v * f for v in sh["ellipse"]], fill=255)
        if "rect" in sh:
            dr.rounded_rectangle([v * f for v in sh["rect"]], radius=sh.get("radius", 0) * f, fill=255)
        if "poly" in sh:
            pts = sh["poly"]
            dr.polygon([(pts[i] * f, pts[i + 1] * f) for i in range(0, len(pts), 2)], fill=255)
    mk = mk.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(mk).astype(np.float32) / 255.0


def _quad(im, q):
    """Perspective-correct a quadrilateral (UL, LL, LR, UR as x,y pairs) to a rectangle."""
    import math
    ul, ll, lr, ur = (q[0], q[1]), (q[2], q[3]), (q[4], q[5]), (q[6], q[7])
    d = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])
    w = int((d(ul, ur) + d(ll, lr)) / 2)
    h = int((d(ul, ll) + d(ur, lr)) / 2)
    return im.transform((w, h), Image.QUAD, data=tuple(q), resample=Image.BICUBIC)


def process(src, dest, crop=None, rotate=0, bg="auto", tol=26, max_side=1600, gain_cap=1.4, fill=None, max_up=1.6, ftol=38, wb=True, quad=None, largest=True, scale=1.0, kmeans=None, erase=None, shapes=None, clip=None):
    im = _load(src)
    if quad:
        im = _quad(im, quad)
    if rotate:
        im = im.rotate(-rotate, expand=True, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    if crop:
        w, h = im.size
        l, t, r, b = crop
        if max(crop) <= 1.0:
            l, t, r, b = l * w, t * h, r * w, b * h
        im = im.crop((int(l), int(t), int(r), int(b)))
    pre_w = im.size[0]
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    ds = im.size[0] / pre_w  # downscale factor for coordinates given in source pixels
    a = np.asarray(im).astype(np.float32)
    bd = _border(a)
    bgc = np.median(bd, axis=0)
    spread = np.percentile(np.abs(bd - bgc).max(axis=1), 75)
    light = bool(bgc.min() > 150)
    mode = bg
    if bg == "auto":
        mode = "white" if (light and spread < 40) else "keep"
    mask = None
    if mode == "trim":
        # already a clean packshot on (near-)white: no masking, only white-balance + trim
        if bgc.min() > 200:
            gain = np.clip(255.0 / np.maximum(bgc, 1), 1.0, 1.15)
            a = np.clip(a * gain, 0, 255)
        lo = a.min(axis=2)
        sat = a.max(axis=2) - lo
        near = (lo > 246) & (sat < 10)
        a[near] = 255.0
        prod = ((255 - lo) > 16) | (sat > 16)
        rows = prod.sum(axis=1) > max(2, 0.003 * prod.shape[1])
        cols = prod.sum(axis=0) > max(2, 0.003 * prod.shape[0])
        mask = np.zeros_like(prod)
        if rows.any() and cols.any():
            ys = np.where(rows)[0]
            xs = np.where(cols)[0]
            mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
    if mode == "shape":
        soft = _shape_mask(shapes, a.shape[1], a.shape[0], ds)
        a = a * soft[..., None] + 255.0 * (1 - soft[..., None])
        mask = soft > 0.5
    if mode == "kmeans":
        soft = _kmeans_mask(a, **(kmeans or {}))
        soft = np.clip((soft - 0.35) / 0.3, 0, 1)  # tighten the feathered edge a little
        for x0, y0, x1, y1 in (erase or []):  # manual clean-up boxes, source pixel coords (after crop)
            soft[int(y0 * ds):int(y1 * ds), int(x0 * ds):int(x1 * ds)] = 0
        if clip:  # generous hand-traced outline: drop anything the colour model kept outside it
            soft = soft * _shape_mask(clip, a.shape[1], a.shape[0], ds)
        a = a * soft[..., None] + 255.0 * (1 - soft[..., None])
        mask = soft > 0.5
    if mode in ("white", "flood"):
        if mode == "white":
            gain = np.clip(250.0 / np.maximum(bgc, 1), 1.0, gain_cap) if wb else np.ones(3)
            a = np.clip(a * gain, 0, 255)
            cand = (a.min(axis=2) > 255 - tol) & ((a.max(axis=2) - a.min(axis=2)) < 22)
        else:  # flood: uniform but not-white background, segment by colour distance to the border colour
            cand = np.abs(a - bgc).max(axis=2) < ftol
        bgmask = _flood_fast(cand)
        if largest:
            bgmask = ~_largest_component(~bgmask)
        m = Image.fromarray((bgmask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        mf = np.asarray(m).astype(np.float32)[..., None] / 255.0
        a = a * (1 - mf) + 255.0 * mf
        mask = np.asarray(m) < 128  # product pixels
    out = Image.fromarray(a.astype(np.uint8))
    # trim
    if mask is not None:
        ys, xs = np.where(mask)
    else:
        diff = np.abs(np.asarray(out).astype(np.int16) - bgc.astype(np.int16)).max(axis=2)
        ys, xs = np.where(diff > 30)
    if len(xs) > 50 and mode != "keep":
        pad = 4
        l, r = max(0, xs.min() - pad), min(out.width, xs.max() + pad + 1)
        t, b = max(0, ys.min() - pad), min(out.height, ys.max() + pad + 1)
        if mode in ("white", "flood", "trim", "kmeans", "shape") or ((r - l) * (b - t) > 0.25 * out.width * out.height):
            out = out.crop((l, t, r, b))
    bw, bh = CANVAS[0] - 2 * MARGIN_X, CANVAS[1] - 2 * MARGIN_Y
    s = min(bw / out.width, bh / out.height, max_up) * scale
    nw, nh = max(1, round(out.width * s)), max(1, round(out.height * s))
    out = out.resize((nw, nh), Image.LANCZOS)
    if s > 1.0:
        out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    else:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2))
    canvas_color = (255, 255, 255) if (mode in ("white", "flood", "trim", "kmeans", "shape") or fill is None) else tuple(fill)
    canvas = Image.new("RGB", CANVAS, canvas_color)
    canvas.paste(out, ((CANVAS[0] - nw) // 2, (CANVAS[1] - nh) // 2))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    canvas.save(dest, "WEBP", quality=82, method=6)
    return {"mode": mode, "bg": [int(x) for x in bgc], "spread": float(spread), "scale": round(s, 2), "src": im.size}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dest")
    ap.add_argument("--crop")
    ap.add_argument("--rotate", type=float, default=0)
    ap.add_argument("--bg", default="auto")
    ap.add_argument("--tol", type=int, default=26)
    x = ap.parse_args()
    crop = [float(v) for v in x.crop.split(",")] if x.crop else None
    print(process(x.src, x.dest, crop=crop, rotate=x.rotate, bg=x.bg, tol=x.tol))
