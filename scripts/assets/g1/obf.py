"""Polite, cached client for the Open Beauty Facts public API (group g1).

- Searches: max 1 request every 6 s (timestamp persisted across runs).
- Image downloads: max 1 per second.
- 429 / 5xx: exponential back-off and retry.
Results are cached under .shots/assets-raw/g1/ so re-runs never re-hit the API.
"""
import json
import hashlib
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g1")
SEARCH_DIR = os.path.join(RAW, "search")
IMG_DIR = os.path.join(RAW, "img")
STAMP = os.path.join(RAW, ".last_search")
UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_url,ingredients_text,categories_tags,countries_tags"
BASE = "https://world.openbeautyfacts.org"

os.makedirs(SEARCH_DIR, exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)

_last_img = [0.0]


def _get(url, timeout=60):
    delay = 10
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, b""
            if e.code == 429 or e.code >= 500:
                print(f"  HTTP {e.code} on {url[:90]} - backing off {delay}s", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                continue
            return e.code, b""
        except Exception as e:  # network hiccup
            print(f"  error {e!r} - retry in {delay}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    return 0, b""


def _wait_search_slot():
    try:
        last = float(open(STAMP).read().strip())
    except Exception:
        last = 0.0
    wait = 6.2 - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    with open(STAMP, "w") as f:
        f.write(str(time.time()))


def search(params, label=None):
    """params: dict of query params (json/fields/page_size added). Cached by hash."""
    p = {"json": "1", "page_size": "50", "fields": FIELDS}
    p.update(params)
    qs = urllib.parse.urlencode(p)
    key = hashlib.sha1(qs.encode()).hexdigest()[:12]
    path = os.path.join(SEARCH_DIR, f"{(label or 'q')}-{key}.json")
    if os.path.exists(path):
        return json.load(open(path))
    _wait_search_slot()
    url = f"{BASE}/cgi/search.pl?{qs}"
    status, body = _get(url)
    if status != 200:
        print(f"  search failed {status}: {url}", file=sys.stderr)
        return {"products": [], "count": 0}
    data = json.loads(body)
    data["_url"] = url
    json.dump(data, open(path, "w"), indent=1)
    return data


def product(code):
    path = os.path.join(SEARCH_DIR, f"product-{code}.json")
    if os.path.exists(path):
        return json.load(open(path))
    _wait_search_slot()
    status, body = _get(f"{BASE}/api/v2/product/{code}.json")
    if status != 200:
        return None
    data = json.loads(body)
    json.dump(data, open(path, "w"), indent=1)
    return data


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    wait = 1.05 - (time.time() - _last_img[0])
    if wait > 0:
        time.sleep(wait)
    _last_img[0] = time.time()
    status, body = _get(url)
    if status != 200 or not body:
        return False
    with open(dest, "wb") as f:
        f.write(body)
    return True
