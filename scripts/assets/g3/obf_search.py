"""Polite Open Beauty Facts search for group g3.

Usage: python3 -I obf_search.py "<query>" ["<query>" ...]
Writes each result to .shots/assets-raw/g3/search/<slug>.json (cached; skips if present).
Rate limit: >= 6 s between search requests, exponential back-off on 429/5xx.
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
OUT = os.path.join(ROOT, ".shots", "assets-raw", "g3", "search")
UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_url,ingredients_text,categories_tags,countries_tags"
STAMP = os.path.join(OUT, ".last")
GAP = 6.5


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def wait_turn():
    try:
        last = float(open(STAMP).read())
    except Exception:
        last = 0
    d = time.time() - last
    if d < GAP:
        time.sleep(GAP - d)
    with open(STAMP, "w") as f:
        f.write(str(time.time()))


def search(q, page_size=50):
    if q.startswith("codes:"):
        # GS1 company-prefix facet, e.g. codes:8906128xxxxxx[:page]
        parts = q.split(":")
        url = ("https://world.openbeautyfacts.org/api/v2/search?codes_tags=" + urllib.parse.quote(parts[1])
               + "&page_size=100&page=" + (parts[2] if len(parts) > 2 else "1") + "&fields=" + FIELDS)
    elif q.startswith("tag:"):
        # brand facet via the official v2 search endpoint
        url = ("https://world.openbeautyfacts.org/api/v2/search?brands_tags=" + urllib.parse.quote(q[4:])
               + "&page_size=100&fields=" + FIELDS)
    else:
        url = ("https://world.openbeautyfacts.org/cgi/search.pl?search_terms=" + urllib.parse.quote(q)
               + "&search_simple=1&json=1&page_size=%d&fields=%s" % (page_size, FIELDS))
    delay = 20
    for attempt in range(5):
        wait_turn()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                print("  HTTP %d, backing off %ds" % (e.code, delay), file=sys.stderr)
                time.sleep(delay); delay *= 2; continue
            raise
        except Exception as e:
            print("  error %s, backing off %ds" % (e, delay), file=sys.stderr)
            time.sleep(delay); delay *= 2
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    for q in sys.argv[1:]:
        path = os.path.join(OUT, slug(q) + ".json")
        if os.path.exists(path):
            print("cached", q); continue
        data = search(q)
        if data is None:
            print("FAILED", q); continue
        with open(path, "w") as f:
            json.dump(data, f)
        prods = data.get("products", [])
        print("%-40s count=%s got=%d withimg=%d" % (q, data.get("count"), len(prods), sum(1 for p in prods if p.get("image_front_url"))))


if __name__ == "__main__":
    main()
