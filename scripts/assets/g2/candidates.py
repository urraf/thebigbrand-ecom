#!/usr/bin/env python3
"""Merge every cached OBF search for the g2 brands into one de-duplicated candidate list.

Writes .shots/assets-raw/g2/candidates.json and prints a TSV summary.
Out-of-scope items (oral care, tablets, medicines) are dropped up-front.
"""
import glob
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.path.join(ROOT, ".shots", "assets-raw", "g2")

PREFIX = {
    "8901138": "himalaya",
    "8904352": "biotique", "8906009": "biotique",
    "8901088": "parachute",
    "8906087": "mamaearth", "8904417": "mamaearth",
    "8906118": "plum", "8904430": "plum",
}
BRAND_WORDS = {"himalaya": "himalaya", "biotique": "biotique", "parachute": "parachute",
               "mamaearth": "mamaearth", "mama earth": "mamaearth", "plum": "plum"}
SKIP = re.compile(r"tooth|dental|mouthwash|tablet|\btab\b|balm rapid|cold balm|liv\.?52|capsule|syrup|diaper", re.I)


def brand_of(p):
    code = p.get("code", "")
    for pre, b in PREFIX.items():
        if code.startswith(pre):
            return b
    br = (p.get("brands") or "").lower()
    for w, b in BRAND_WORDS.items():
        if w in br:
            # "plum" in a brand string must be the Plum brand, not a shade
            if b == "plum" and br.strip() not in ("plum", "plum goodness"):
                continue
            return b
    return None


def main():
    seen = {}
    for f in glob.glob(os.path.join(RAW, "cache", "*.json")):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        for p in d.get("products") or []:
            if not p.get("image_front_url"):
                continue
            b = brand_of(p)
            if not b:
                continue
            name = p.get("product_name_en") or p.get("product_name") or ""
            if SKIP.search(name):
                continue
            code = p["code"]
            if code in seen:
                continue
            seen[code] = {
                "code": code, "brand": b, "name": name, "quantity": p.get("quantity") or "",
                "image_front_url": p["image_front_url"],
                "ingredients_text": p.get("ingredients_text") or "",
                "countries": p.get("countries_tags") or [],
            }
    items = sorted(seen.values(), key=lambda x: (x["brand"], x["code"]))
    json.dump(items, open(os.path.join(RAW, "candidates.json"), "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(Counter(i["brand"] for i in items))
    for i in items:
        print(f"{i['brand']}\t{i['code']}\t{i['name'][:60]}\t{i['quantity']}")


if __name__ == "__main__":
    main()
