#!/usr/bin/env python3
"""Licensed lifestyle photography for ad creatives & editorial tiles.

Sources (official public APIs only, licence metadata kept for every file):
  * Openverse      https://api.openverse.org/v1/images/
  * Wikimedia Commons https://commons.wikimedia.org/w/api.php

Usage (run with `python3 -I`, from anywhere):
  lifestyle.py search ov <slug> "<query>" [--license cc0,pdm] [--source a,b] [--page N]
  lifestyle.py search wc <slug> "<query>" [--minw 2000] [--limit 40]
  lifestyle.py sheet <slug>                 # rebuild the numbered contact sheet
  lifestyle.py peek <slug> <n> [<n> ...]    # larger previews of chosen candidates (one sheet)
  lifestyle.py refetch <slug> [...]         # retry missing previews
  lifestyle.py fetch [gap-seconds]          # download the originals named in picks.json (sequential)
  lifestyle.py build [--only name,name]     # picks.json -> public/media/lifestyle/*.webp + ad-images.json
  lifestyle.py review <bucket|name> [...]   # labelled QA sheet of finished WebPs

picks.json: one entry per output image {bucket, name, key, cand "<slug>#<n>", focus [x,y],
zoom, flip, retouch [{box, mode min|max|blur, size}], alt} plus byAd {adId: name}.
Commons originals are fetched with curl (the Python client was throttled by upload.wikimedia.org).

Working files (downloads are untrusted data and live outside the scripts dir):
  .shots/assets-raw/lifestyle/cand/<slug>.json   normalised candidates
  .shots/assets-raw/lifestyle/prev/<slug>/<n>.jpg preview thumbnails
  .shots/assets-raw/lifestyle/sheets/<slug>.jpg   numbered contact sheet
  .shots/assets-raw/lifestyle/orig/<slug>-<n>.*   full-resolution originals
"""
from __future__ import annotations

import concurrent.futures as cf
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = 400_000_000

UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
ROOT = Path(__file__).resolve().parents[3]  # platform/
RAW = ROOT / ".shots" / "assets-raw" / "lifestyle"
CAND = RAW / "cand"
PREV = RAW / "prev"
SHEETS = RAW / "sheets"
ORIG = RAW / "orig"
OUT = ROOT / "public" / "media" / "lifestyle"
PICKS = Path(__file__).resolve().parent / "picks.json"
JSON_OUT = ROOT / "prisma" / "seed-data" / "ad-images.json"
OV_COUNT = RAW / "openverse-searches.txt"
OV_MAX = 60

for d in (CAND, PREV, SHEETS, ORIG, OUT):
    d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- http
def curl_get(url: str, timeout: int = 60) -> bytes:
    import subprocess
    r = subprocess.run(["curl", "-sS", "-L", "--max-time", str(timeout), "-A", UA, "-w", "\n%{http_code}", url], capture_output=True)
    body, _, code = r.stdout.rpartition(b"\n")
    if code.strip() != b"200":
        raise RuntimeError(f"HTTP {code.decode().strip()} for {url[:90]}")
    return body


def http_get(url: str, *, accept: str = "*/*", timeout: int = 60, tries: int = 4) -> bytes:
    if "upload.wikimedia.org" in url:
        return curl_get(url, timeout)
    delay = 8
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if e.code in (429, 503) and attempt < tries - 1:
                ra = e.headers.get("Retry-After")
                wait = int(ra) if ra and ra.isdigit() else delay
                print(f"  {e.code} on {url[:80]} - backing off {wait}s", file=sys.stderr)
                time.sleep(min(wait, 20))
                delay *= 2
                continue
            raise
        except Exception:
            if attempt < tries - 1:
                time.sleep(2)
                continue
            raise
    raise RuntimeError("unreachable")


def http_json(url: str) -> dict:
    return json.loads(http_get(url, accept="application/json"))


# ---------------------------------------------------------------- licences
def ov_license(code: str, version: str | None) -> str:
    code = (code or "").lower()
    v = (version or "").strip()
    if code == "cc0":
        return f"CC0 {v or '1.0'}"
    if code == "pdm":
        return f"Public Domain Mark {v or '1.0'}"
    return f"CC {code.upper()} {v}".strip()


def strip_html(s: str | None) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


ALLOWED_WC = re.compile(r"^(cc0|cc[- ]zero|public domain|pd|cc[- ]by(-sa)?[- ]?\d(\.\d)?)", re.I)


# ---------------------------------------------------------------- search
def ov_search(slug: str, query: str, license_: str | None, source: str | None, page: int) -> list[dict]:
    used = int(OV_COUNT.read_text()) if OV_COUNT.exists() else 0
    if used >= OV_MAX:
        sys.exit(f"Openverse search budget exhausted ({used}/{OV_MAX})")
    params = {
        "q": query,
        "license_type": "commercial,modification",
        "page_size": "20",
        "page": str(page),
        "mature": "false",
    }
    if os.environ.get("OV_SIZE", "large"):
        params["size"] = os.environ.get("OV_SIZE", "large")
    if os.environ.get("OV_CAT"):
        params["category"] = os.environ["OV_CAT"]
    if license_:
        params["license"] = license_
    if source:
        params["source"] = source
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)
    data = http_json(url)
    OV_COUNT.write_text(str(used + 1))
    print(f"openverse searches used: {used + 1}/{OV_MAX}  (result_count={data.get('result_count')})")
    out = []
    for r in data.get("results", []):
        lic = (r.get("license") or "").lower()
        if lic not in ("cc0", "pdm", "by", "by-sa"):
            continue
        out.append({
            "provider": "Openverse",
            "upstream": r.get("source") or r.get("provider"),
            "id": r.get("id"),
            "title": (r.get("title") or "").strip() or "Untitled",
            "creator": (r.get("creator") or "").strip() or "Unknown",
            "license": ov_license(lic, r.get("license_version")),
            "licenseUrl": r.get("license_url") or "",
            "sourceUrl": r.get("foreign_landing_url") or "",
            "url": r.get("url"),
            "thumb": preview_url(r.get("url") or ""),
            "width": r.get("width") or 0,
            "height": r.get("height") or 0,
            "tags": [t.get("name") for t in (r.get("tags") or [])][:12],
        })
    return out


def wc_search(slug: str, query: str, minw: int, limit: int) -> list[dict]:
    q = f"{query} filew:>{minw} filemime:image/jpeg"
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "search", "gsrsearch": q, "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "500",
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|ObjectName|Restrictions|License|Credit",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = http_json(url)
    pages = sorted((data.get("query") or {}).get("pages", []), key=lambda p: p.get("index", 0))
    out = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lic = strip_html((md.get("LicenseShortName") or {}).get("value"))
        if not ALLOWED_WC.match(lic):
            continue
        restr = strip_html((md.get("Restrictions") or {}).get("value"))
        title = strip_html((md.get("ObjectName") or {}).get("value")) or re.sub(r"^File:|\.[a-z]+$", "", p.get("title", ""), flags=re.I)
        lic_url = strip_html((md.get("LicenseUrl") or {}).get("value"))
        if lic.lower().startswith(("public domain", "pd")) and not lic_url:
            lic_url = "https://creativecommons.org/publicdomain/mark/1.0/"
        out.append({
            "provider": "Wikimedia Commons",
            "upstream": "wikimedia",
            "id": p.get("pageid"),
            "title": title,
            "creator": strip_html((md.get("Artist") or {}).get("value")) or "Unknown",
            "license": normalise_wc_license(lic),
            "licenseUrl": lic_url,
            "sourceUrl": ii.get("descriptionurl") or "",
            "url": ii.get("url"),
            "thumb": ii.get("thumburl") or ii.get("url"),
            "width": ii.get("width") or 0,
            "height": ii.get("height") or 0,
            "restrictions": restr,
        })
    return out


def normalise_wc_license(lic: str) -> str:
    l = lic.strip()
    if re.match(r"^cc0", l, re.I) or re.match(r"^cc[- ]zero", l, re.I):
        return "CC0 1.0"
    if re.match(r"^(public domain|pd)", l, re.I):
        return "Public domain"
    m = re.match(r"^cc[- ]by(-sa)?[- ]?(\d(\.\d)?)", l, re.I)
    if m:
        return f"CC BY{'-SA' if m.group(1) else ''} {m.group(2)}"
    return l


def preview_url(url: str) -> str:
    """Smallest reasonable rendition for a contact-sheet preview."""
    if "staticflickr.com" in url:
        return re.sub(r"(_[a-z])?\.(jpg|png)$", r"_n.\2", url)
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w)/(\w\w)/(.+)$", url)
    if m:
        a, b, f = m.groups()
        return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{f}/500px-{f}"
    return url


# ---------------------------------------------------------------- previews / sheets
def fetch_preview(path: Path, url: str) -> bool:
    if path.exists() and path.stat().st_size > 0:
        return True
    try:
        raw = http_get(url, timeout=40, tries=2)
        time.sleep(0.4)
        im = Image.open(io.BytesIO(raw))
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((640, 640))
        im.save(path, "JPEG", quality=82)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  preview failed {url[:90]}: {e}", file=sys.stderr)
        return False


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_sheet(slug: str, ids: list[int] | None = None, cell=(360, 270), cols=5, out: Path | None = None) -> Path:
    cands = json.loads((CAND / f"{slug}.json").read_text())
    idx = ids if ids is not None else list(range(len(cands)))
    tiles = []
    for n in idx:
        p = PREV / slug / f"{n}.jpg"
        if not p.exists():
            continue
        tiles.append((n, p))
    rows = max(1, (len(tiles) + cols - 1) // cols)
    W, H = cell
    sheet = Image.new("RGB", (cols * W, rows * (H + 26)), (245, 245, 245))
    dr = ImageDraw.Draw(sheet)
    f = font(17)
    for k, (n, p) in enumerate(tiles):
        im = Image.open(p).convert("RGB")
        im.thumbnail((W - 6, H - 6))
        x, y = (k % cols) * W, (k // cols) * (H + 26)
        sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
        c = cands[n]
        lic = c["license"].replace("Public Domain Mark", "PDM").replace("Public domain", "PD")
        dr.text((x + 6, y + H + 3), f"#{n} {c['width']}x{c['height']} {lic}", fill=(20, 20, 20), font=f)
    out = out or SHEETS / f"{slug}.jpg"
    sheet.save(out, "JPEG", quality=85)
    return out


def cmd_search(argv: list[str]) -> None:
    prov, slug, query = argv[0], argv[1], argv[2]
    opts = dict(zip(argv[3::2], argv[4::2]))
    if (CAND / f"{slug}.json").exists() and opts.get("--force") != "1":
        sys.exit(f"slug {slug} already searched (pass --force 1 to redo)")
    if prov == "ov":
        cands = ov_search(slug, query, opts.get("--license"), opts.get("--source"), int(opts.get("--page", 1)))
    elif prov == "wc":
        cands = wc_search(slug, query, int(opts.get("--minw", 1800)), int(opts.get("--limit", 40)))
    else:
        sys.exit("provider must be ov or wc")
    minw = int(opts.get("--minw", 0)) if prov == "ov" else 0
    if minw:
        cands = [c for c in cands if max(c["width"], c["height"]) >= minw]
    (CAND / f"{slug}.json").write_text(json.dumps(cands, indent=1, ensure_ascii=False))
    d = PREV / slug
    if d.exists():
        for f in d.iterdir():
            f.unlink()
    d.mkdir(parents=True, exist_ok=True)
    with cf.ThreadPoolExecutor(max_workers=2) as ex:
        list(ex.map(lambda nc: fetch_preview(d / f"{nc[0]}.jpg", nc[1]["thumb"]), enumerate(cands)))
    out = make_sheet(slug)
    for n, c in enumerate(cands):
        print(f"#{n:<2} {c['width']}x{c['height']:<5} {c['license']:<18} {c.get('upstream','')[:10]:<10} {c['title'][:60]} | {c['creator'][:30]}")
    print("sheet:", out)


def cmd_refetch(argv: list[str]) -> None:
    for slug in argv:
        cands = json.loads((CAND / f"{slug}.json").read_text())
        d = PREV / slug
        miss = [(n, c) for n, c in enumerate(cands) if not (d / f"{n}.jpg").exists()]
        for n, c in miss:
            fetch_preview(d / f"{n}.jpg", c["thumb"])
        print(slug, "refetched", len(miss), "->", make_sheet(slug))


def cmd_peek(argv: list[str]) -> None:
    slug = argv[0]
    ids = [int(x) for x in argv[1:]]
    out = SHEETS / f"{slug}-peek.jpg"
    make_sheet(slug, ids, cell=(640, 480), cols=2 if len(ids) <= 4 else 3, out=out)
    print("peek:", out)


# ---------------------------------------------------------------- build
SIZES = {
    "billboards": (2400, 840),
    "cards": (900, 700),
    "leaderboards": (2400, 400),
    "video": (1600, 900),
    "reels": (720, 1280),
    "categories": (800, 800),
    "concerns": (800, 800),
    "heroes": (2400, 1000),
}


def original_path(slug: str, n: int, url: str) -> Path:
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    return ORIG / f"{slug}-{n}{ext}"


def original_source(c: dict) -> str:
    url = c["url"].split("?")[0]
    # Very large Commons originals: the standard 3840px rendition is plenty and saves bandwidth.
    m = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w)/(\w\w)/(.+)$", url)
    if m and c.get("width", 0) > 4000:
        a, b, f = m.groups()
        return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{f}/3840px-{f}"
    return url


def fetch_original(slug: str, n: int, c: dict, gap: float = 3.0) -> Path:
    """Download one original/rendition with curl (sequential, identified UA, stops on 429)."""
    import subprocess
    p = original_path(slug, n, c["url"].split("?")[0])
    if p.exists() and p.stat().st_size > 0:
        return p
    src = original_source(c)
    tmp = p.with_suffix(p.suffix + ".part")
    for attempt in range(3):
        r = subprocess.run(
            ["curl", "-sS", "-L", "--max-time", "180", "-A", UA, "-o", str(tmp), "-w", "%{http_code}", src],
            capture_output=True, text=True,
        )
        code = (r.stdout or "").strip()
        if code == "200" and tmp.exists() and tmp.stat().st_size > 1000:
            tmp.rename(p)
            time.sleep(gap)
            return p
        if tmp.exists():
            tmp.unlink()
        if code == "429":
            print(f"  429 for {p.name} - backing off 180s", flush=True)
            time.sleep(180)
            continue
        print(f"  HTTP {code} for {src} {r.stderr.strip()[:120]}", flush=True)
        time.sleep(5)
    raise RuntimeError(f"could not fetch {src}")


def load_original(slug: str, n: int, c: dict) -> Image.Image:
    p = fetch_original(slug, n, c)
    im = Image.open(p)
    im = ImageOps.exif_transpose(im)
    return im.convert("RGB")


def cmd_fetch(argv: list[str]) -> None:
    gap = float(argv[0]) if argv else 3.0
    picks = json.loads(PICKS.read_text())["images"]
    seen = set()
    for pk in picks:
        slug, n = pk["cand"].split("#")
        if pk["cand"] in seen:
            continue
        seen.add(pk["cand"])
        c = json.loads((CAND / f"{slug}.json").read_text())[int(n)]
        p = fetch_original(slug, int(n), c, gap)
        print(f"  ok {p.name} ({p.stat().st_size // 1024} KB)", flush=True)


def crop_to(im: Image.Image, size: tuple[int, int], focus=(0.5, 0.5), zoom: float = 1.0, box=None) -> Image.Image:
    tw, th = size
    if box:  # explicit fractional box [x0,y0,x1,y1] - expanded/adjusted to aspect around its centre
        x0, y0, x1, y1 = box
        focus = ((x0 + x1) / 2, (y0 + y1) / 2)
        bw, bh = (x1 - x0) * im.width, (y1 - y0) * im.height
        target_ratio = tw / th
        if bw / bh > target_ratio:
            cw = bw
        else:
            cw = bh * target_ratio
        zoom = max(1.0, min(im.width / cw, im.height / (cw / target_ratio)))
    ar = tw / th
    if im.width / im.height > ar:
        ch = im.height / zoom
        cw = ch * ar
    else:
        cw = im.width / zoom
        ch = cw / ar
    cx, cy = focus[0] * im.width, focus[1] * im.height
    x0 = min(max(0, cx - cw / 2), im.width - cw)
    y0 = min(max(0, cy - ch / 2), im.height - ch)
    region = im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))
    return region.resize((tw, th), Image.LANCZOS), (cw, ch)


def clean_creator(s: str) -> str:
    s = re.sub(r"\(\s*https?://[^)]*\)", "", s or "")
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"^(Unknown author)\s*\1$", r"\1", s.strip())
    return re.sub(r"\s+", " ", s).strip() or "Unknown"


def clean_title(s: str) -> str:
    s = re.sub(r"\s*\(\d{8,}\)\s*$", "", s or "").strip()
    s = re.sub(r"\s*-\s*\d{8,}\s*$", "", s).strip()
    return s.rstrip(".") or "Untitled"


def retouch(im: Image.Image, rt: dict) -> Image.Image:
    """Remove small printed marks (e.g. a maker's wordmark) inside a fractional box.
    mode "min": light text on a dark surface; "max": dark text on a light surface; "blur": soften."""
    from PIL import ImageFilter
    x0, y0, x1, y1 = rt["box"]
    box = (round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))
    region = im.crop(box)
    size = int(rt.get("size", 11)) | 1
    mode = rt.get("mode", "min")
    if mode == "min":
        fixed = region.filter(ImageFilter.MinFilter(size)).filter(ImageFilter.GaussianBlur(1.5))
    elif mode == "max":
        fixed = region.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.GaussianBlur(1.5))
    else:
        fixed = region.filter(ImageFilter.GaussianBlur(size))
    mask = Image.new("L", region.size, 0)
    feather = max(2, min(region.size) // 6)
    ImageDraw.Draw(mask).rectangle((feather, feather, region.width - feather, region.height - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    out = im.copy()
    out.paste(Image.composite(fixed, region, mask), box)
    return out


def attribution(c: dict) -> str:
    return f"{clean_title(c['title'])} by {clean_creator(c['creator'])}, {c['license']}"


def cmd_build(argv: list[str]) -> None:
    opts = dict(zip(argv[0::2], argv[1::2]))
    only = set(opts.get("--only", "").split(",")) - {""}
    picks = json.loads(PICKS.read_text())
    cand_cache: dict[str, list] = {}
    imgs: dict[str, dict] = {}
    warnings = []
    for pk in picks["images"]:
        name = pk["name"]
        slug, n = pk["cand"].split("#")
        n = int(n)
        if slug not in cand_cache:
            cand_cache[slug] = json.loads((CAND / f"{slug}.json").read_text())
        c = cand_cache[slug][n]
        size = SIZES[pk["bucket"]]
        out = OUT / f"{name}.webp"
        if not only or name in only:
            im = load_original(slug, n, c)
            if pk.get("flip"):
                im = ImageOps.mirror(im)
            res, (cw, ch) = crop_to(im, size, tuple(pk.get("focus", (0.5, 0.5))), float(pk.get("zoom", 1.0)), pk.get("box"))
            if cw < size[0] * 0.8:
                warnings.append(f"{name}: upscaled {cw:.0f}px -> {size[0]}px")
            for rt in pk.get("retouch", []):
                res = retouch(res, rt)
            if pk.get("tone"):
                from PIL import ImageEnhance
                t = pk["tone"]
                if "b" in t:
                    res = ImageEnhance.Brightness(res).enhance(t["b"])
                if "c" in t:
                    res = ImageEnhance.Contrast(res).enhance(t["c"])
                if "s" in t:
                    res = ImageEnhance.Color(res).enhance(t["s"])
            res.save(out, "WEBP", quality=80, method=6)
            print(f"  wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB) from {c['width']}x{c['height']} crop {cw:.0f}x{ch:.0f}")
        imgs[name] = {
            "url": f"/media/lifestyle/{name}.webp",
            "width": size[0],
            "height": size[1],
            "alt": pk["alt"],
            "source": c["provider"],
            "sourceUrl": c["sourceUrl"],
            "creator": clean_creator(c["creator"]),
            "license": c["license"],
            "licenseUrl": c["licenseUrl"],
            "attribution": attribution(c),
        }
    by_bucket: dict[str, list] = {b: [] for b in SIZES}
    for pk in picks["images"]:
        by_bucket[pk["bucket"]].append(pk)
    doc = {
        "_note": "Licensed lifestyle photography for ad creatives and editorial tiles. Every file was cropped, resized and re-encoded as WebP from the linked original (a few had small printed marks softened); derivatives keep their source licence (CC BY-SA files remain CC BY-SA). Credit each image with its `attribution` + `licenseUrl` (e.g. on a photo-credits page). List items also carry a `key`. Regenerate with: python3 -I scripts/assets/lifestyle/lifestyle.py build",
        "billboards": [imgs[p["name"]] for p in by_bucket["billboards"]],
        "cards": [imgs[p["name"]] for p in by_bucket["cards"]],
        "leaderboards": [imgs[p["name"]] for p in by_bucket["leaderboards"]],
        "video": [imgs[p["name"]] for p in by_bucket["video"]],
        "reels": [imgs[p["name"]] for p in by_bucket["reels"]],
        "categories": {p["key"]: imgs[p["name"]] for p in by_bucket["categories"]},
        "concerns": {p["key"]: imgs[p["name"]] for p in by_bucket["concerns"]},
        "heroes": {p["key"]: imgs[p["name"]] for p in by_bucket["heroes"]},
        "byAd": {ad: imgs[name] for ad, name in picks["byAd"].items()},
    }
    # keyed list members also expose their key (e.g. reels r1..r6, billboards by theme)
    for b in ("billboards", "cards", "leaderboards", "video", "reels"):
        for img, p in zip(doc[b], by_bucket[b]):
            if p.get("key"):
                img["key"] = p["key"]
    JSON_OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print("wrote", JSON_OUT.relative_to(ROOT))
    for w in warnings:
        print("WARN", w)


def cmd_review(argv: list[str]) -> None:
    """Lay out finished WebPs of one bucket (or named files) on a labelled sheet for visual QA."""
    picks = json.loads(PICKS.read_text())["images"]
    want = set(argv)
    sel = [p for p in picks if p["bucket"] in want or p["name"] in want]
    if not sel:
        sys.exit("nothing selected")
    rev = RAW / "review"
    rev.mkdir(exist_ok=True)
    tw = 1800
    w0, h0 = SIZES[sel[0]["bucket"]]
    cols = 1 if w0 >= 2000 else (2 if w0 >= 1200 or h0 > w0 * 1.2 and False else 3)
    if h0 > w0:
        cols = 6
    cw = tw // cols
    tiles = []
    for p in sel:
        f = OUT / f"{p['name']}.webp"
        if not f.exists():
            continue
        im = Image.open(f).convert("RGB")
        im = im.resize((cw - 8, round((cw - 8) * im.height / im.width)))
        tiles.append((p["name"], im))
    rows = []
    for i in range(0, len(tiles), cols):
        rows.append(tiles[i:i + cols])
    H = sum(max(t[1].height for t in r) + 28 for r in rows)
    sheet = Image.new("RGB", (tw, H), (250, 250, 250))
    dr = ImageDraw.Draw(sheet)
    f = font(18)
    y = 0
    for r in rows:
        rh = max(t[1].height for t in r)
        for k, (name, im) in enumerate(r):
            x = k * cw + 4
            dr.text((x, y + 4), name, fill=(190, 0, 0), font=f)
            sheet.paste(im, (x, y + 26))
        y += rh + 28
    out = rev / f"{'-'.join(sorted(want))[:60]}.jpg"
    if sheet.height > 2600:
        sheet = sheet.resize((round(sheet.width * 2600 / sheet.height), 2600))
    sheet.save(out, "JPEG", quality=86)
    print(out)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, argv = sys.argv[1], sys.argv[2:]
    {"search": cmd_search, "sheet": lambda a: print(make_sheet(a[0])), "peek": cmd_peek, "refetch": cmd_refetch, "review": cmd_review, "fetch": cmd_fetch, "build": cmd_build}[cmd](argv)


if __name__ == "__main__":
    main()
