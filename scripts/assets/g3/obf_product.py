"""Fetch full product records (official v2 product API) politely: >= 2 s apart.

Usage: python3 -I obf_product.py <code> [<code> ...]  -> .shots/assets-raw/g3/product/<code>.json
"""
import json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
OUT = os.path.join(ROOT, ".shots", "assets-raw", "g3", "product")
UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
os.makedirs(OUT, exist_ok=True)
for code in sys.argv[1:]:
    path = os.path.join(OUT, code + ".json")
    if os.path.exists(path):
        continue
    delay = 15
    for attempt in range(5):
        time.sleep(2.0)
        try:
            req = urllib.request.Request("https://world.openbeautyfacts.org/api/v2/product/%s.json" % code,
                                         headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            json.dump(data, open(path, "w"))
            p = data.get("product", {})
            raws = [k for k in p.get("images", {}) if k.isdigit()]
            print(code, "raw images:", len(raws), "|", p.get("product_name"))
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                print("  HTTP", e.code, "back-off", delay); time.sleep(delay); delay *= 2; continue
            print(code, "HTTP", e.code); break
        except Exception as e:
            print("  err", e); time.sleep(delay); delay *= 2
