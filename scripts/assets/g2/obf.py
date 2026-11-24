#!/usr/bin/env python3
"""Open Beauty Facts helper for the g2 catalogue build (himalaya, biotique, parachute, mamaearth, plum).

Polite client: descriptive User-Agent, >= 6 s between search requests, >= 1 s between image
downloads, exponential back-off on 429/5xx. Responses are cached under .shots/assets-raw/g2/.

Usage (run with python3 -I):
  obf.py search "<terms>" [--pages N]       -> caches JSON, prints a compact candidate list
  obf.py brand  "<brand tag>" [--pages N]   -> search by brand facet (brands_tags)
  obf.py codes  "<GS1 prefix>xxxxxx" [--pages N] -> products whose barcode starts with a company prefix
  obf.py fetch  <code> [<code> ...]         -> downloads front image (full, fallback 400) to raw/img/<code>.jpg
  obf.py product <code>                     -> fetch + cache full product JSON, print key fields
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g2")
CACHE = os.path.join(RAW, "cache")
IMG = os.path.join(RAW, "img")
STAMP = os.path.join(RAW, ".last_request")
UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_url,ingredients_text,categories_tags,countries_tags,image_url,images"
os.makedirs(CACHE, exist_ok=True)
os.makedirs(IMG, exist_ok=True)


def _wait(kind, gap):
    path = STAMP + "." + kind
    try:
        last = float(open(path).read().strip())
    except Exception:
        last = 0.0
    delta = time.time() - last
    if delta < gap:
        time.sleep(gap - delta)
    with open(path, "w") as f:
        f.write(str(time.time()))


def _get(url, kind, gap, binary=False, tries=5):
    backoff = 15
    for attempt in range(tries):
        _wait(kind, gap)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                return data if binary else json.loads(data.decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429 or e.code >= 500:
                sys.stderr.write(f"  HTTP {e.code} on {url[:90]} - backing off {backoff}s\n")
                time.sleep(backoff)
                backoff *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            sys.stderr.write(f"  network error {e} - backing off {backoff}s\n")
            time.sleep(backoff)
            backoff *= 2
    return None


def _slug(s):
    return "".join(c if c.isalnum() else "_" for c in s.lower())[:80]


def _print(products):
    for p in products:
        name = p.get("product_name_en") or p.get("product_name") or ""
        img = "IMG" if p.get("image_front_url") else "---"
        ctry = ",".join(c.replace("en:", "") for c in (p.get("countries_tags") or [])[:3])
        ing = "ING" if p.get("ingredients_text") else "   "
        print(f"{p.get('code','')}\t{img}\t{ing}\t{(p.get('brands') or '')[:22]:22}\t{name[:60]:60}\t{p.get('quantity') or ''}\t{ctry}")


def search(terms, pages=1):
    out = []
    for page in range(1, pages + 1):
        cpath = os.path.join(CACHE, f"s_{_slug(terms)}_{page}.json")
        if os.path.exists(cpath):
            data = json.load(open(cpath))
        else:
            q = urllib.parse.urlencode({
                "search_terms": terms, "search_simple": 1, "json": 1, "page_size": 50,
                "page": page, "fields": FIELDS,
            })
            data = _get("https://world.openbeautyfacts.org/cgi/search.pl?" + q, "search", 6.2)
            if data is None:
                break
            json.dump(data, open(cpath, "w"))
        prods = data.get("products") or []
        out.extend(prods)
        if len(prods) < 50:
            break
    return out


def brand(tag, pages=1, tagtype="brands"):
    out = []
    for page in range(1, pages + 1):
        prefix = "b" if tagtype == "brands" else "t_" + tagtype
        cpath = os.path.join(CACHE, f"{prefix}_{_slug(tag)}_{page}.json")
        if os.path.exists(cpath):
            data = json.load(open(cpath))
        else:
            q = urllib.parse.urlencode({
                "action": "process", "tagtype_0": tagtype, "tag_contains_0": "contains",
                "tag_0": tag, "json": 1, "page_size": 100, "page": page, "fields": FIELDS,
            })
            data = _get("https://world.openbeautyfacts.org/cgi/search.pl?" + q, "search", 6.2)
            if data is None:
                break
            json.dump(data, open(cpath, "w"))
        prods = data.get("products") or []
        out.extend(prods)
        if len(prods) < 100:
            break
    return out


def product(code):
    cpath = os.path.join(CACHE, f"p_{code}.json")
    if os.path.exists(cpath):
        return json.load(open(cpath))
    data = _get(f"https://world.openbeautyfacts.org/api/v2/product/{code}.json", "search", 6.2)
    if data:
        json.dump(data, open(cpath, "w"))
    return data


def find_cached(code):
    """Look a code up in any cached search/brand JSON."""
    for fn in os.listdir(CACHE):
        if not fn.endswith(".json"):
            continue
        try:
            d = json.load(open(os.path.join(CACHE, fn)))
        except Exception:
            continue
        if "products" in d:
            for p in d["products"]:
                if p.get("code") == code:
                    return p
        elif d.get("code") == code and d.get("product"):
            return d["product"]
    return None


def fetch(code, url=None):
    dest = os.path.join(IMG, f"{code}.jpg")
    if os.path.exists(dest) and os.path.getsize(dest) > 2000:
        return dest
    if not url:
        p = find_cached(code)
        url = p and p.get("image_front_url")
    if not url:
        p = (product(code) or {}).get("product") or {}
        url = p.get("image_front_url")
    if not url:
        print(f"{code}: no front image")
        return None
    full = url.replace(".400.jpg", ".full.jpg") if url.endswith(".400.jpg") else url
    data = _get(full, "img", 1.1, binary=True)
    if (not data or len(data) < 15000) and full != url:
        data400 = _get(url, "img", 1.1, binary=True)
        if data400 and (not data or len(data400) > len(data)):
            data = data400
    if not data:
        print(f"{code}: download failed")
        return None
    with open(dest, "wb") as f:
        f.write(data)
    return dest


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    cmd = args[0]
    pages = 1
    if "--pages" in args:
        i = args.index("--pages")
        pages = int(args[i + 1])
        args = args[:i] + args[i + 2:]
    if cmd == "search":
        _print(search(args[1], pages))
    elif cmd == "brand":
        _print(brand(args[1], pages))
    elif cmd == "codes":
        _print(brand(args[1], pages, tagtype="codes"))
    elif cmd == "fetch":
        for c in args[1:]:
            path = fetch(c)
            if path:
                try:
                    from PIL import Image
                    im = Image.open(path)
                    print(f"{c}\t{im.size[0]}x{im.size[1]}\t{os.path.getsize(path)//1024}KB\t{path}")
                except Exception as e:
                    print(f"{c}\tunreadable {e}")
    elif cmd == "product":
        d = product(args[1])
        p = (d or {}).get("product") or {}
        print(json.dumps({k: p.get(k) for k in ["code", "product_name", "product_name_en", "brands", "quantity", "image_front_url", "ingredients_text", "countries_tags"]}, indent=1, ensure_ascii=False))
