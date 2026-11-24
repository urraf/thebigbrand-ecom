"""Process the curated g1 picks into packshots and write prisma/seed-data/catalog/g1.json.

Usage: python3 -I scripts/assets/g1/build.py [--only code_or_slug,...] [--no-images]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import obf  # noqa: E402
import picks  # noqa: E402
from process import process  # noqa: E402

ROOT = obf.ROOT
MEDIA = os.path.join(ROOT, "public", "media", "products")
OUT = os.path.join(ROOT, "prisma", "seed-data", "catalog", "g1.json")
LICENSE = "CC BY-SA 3.0"
ATTRIB = "Open Beauty Facts contributors"
CATS = {"skin", "face", "hair", "oil", "makeup", "body", "men", "fragrance"}
CONCERNS = {"hairfall", "acne", "dandruff", "dull", "tan", "dry", "frizz", "darkcircles", "beard"}
BADGES = {None, "Bestseller", "New", "Derm pick"}
FIXES = {
    "helianthusannuus ( sunflower)  seed oil": "helianthus annuus (sunflower) seed oil",
    "methylchliroisothiazolinone and methylsothiazolinone": "methylchloroisothiazolinone and methylisothiazolinone",
    "TEA-DODEYLBENZENESULFONATE": "TEA-DODECYLBENZENESULFONATE",
}


def slugify(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    s = re.sub(r"['’]", "", s).replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def clean_ingredients(t):
    t = re.sub(r"^\s*(pp\s+)?ingredients?\s*:\s*", "", t.strip(), flags=re.I)
    for a, b in FIXES.items():
        t = t.replace(a, b)
    t = re.sub(r"\s+", " ", t).strip()
    return t[0].upper() + t[1:] if t else t


def demo_data():
    js = "const d=require(process.argv[1]);console.log(JSON.stringify({b:d.BRANDS,p:d.PRODUCTS}))"
    out = subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "prisma", "seed-data", "demo-data.cjs")])
    return json.loads(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--no-images", action="store_true")
    a = ap.parse_args()
    only = set(x for x in a.only.split(",") if x)
    cands = json.load(open(os.path.join(obf.RAW, "candidates.json")))
    demo = demo_data()
    bname = {b["id"]: b["name"] for b in demo["b"]}
    demo_by_id = {p["id"]: p for p in demo["p"]}
    taken = {slugify(f"{bname[p['brand']]} {p['name']}") for p in demo["p"]}

    def image(spec, brand, slug, idx):
        code = spec["code"]
        src = os.path.join(obf.IMG_DIR, f"{code}.full.jpg")
        if not os.path.exists(src):
            src = os.path.join(obf.IMG_DIR, f"{code}.400.jpg")
        fname = f"{slug}.webp" if idx == 0 else f"{slug}-{idx + 1}.webp"
        dest = os.path.join(MEDIA, brand, fname)
        opts = {k: v for k, v in spec.items() if k not in ("code", "alt") and v is not None}
        if not a.no_images and (not only or code in only or slug in only):
            info = process(src, dest, **opts)
            print(f"  {brand}/{fname:70s} {info['mode']:5s} scale={info['scale']}")
        return {
            "url": f"/media/products/{brand}/{fname}", "alt": spec["alt"], "width": 1000, "height": 1250,
            "source": "Open Beauty Facts", "sourceUrl": f"https://world.openbeautyfacts.org/product/{code}",
            "license": LICENSE, "attribution": ATTRIB,
        }

    products, seen = [], set()
    for p in picks.P:
        assert p["brand"] in bname and p["brand"] != "tbb", p["brand"]
        assert p["category"] in CATS and set(p["concerns"]) <= CONCERNS and p.get("badge") in BADGES, p["name"]
        assert 3.9 <= p["rating"] <= 4.7 and 200 <= p["reviews"] <= 60000, p["name"]
        assert p["price"] < p["mrp"] and 0.70 * p["mrp"] <= p["price"] <= 0.95 * p["mrp"] + 1, (p["name"], p["price"], p["mrp"])
        assert len(p["bullets"]) == 4, p["name"]
        slug = slugify(f"{bname[p['brand']]} {p['name']}")
        assert slug not in taken and slug not in seen, f"duplicate slug {slug}"
        seen.add(slug)
        ing = p.get("ingredients")
        if ing in (None, "OBF"):
            raw = cands[p["img"][0]["code"]].get("ingredients_text")
            assert raw, f"no OBF ingredients for {p['name']}"
            ing = clean_ingredients(raw)
        products.append({
            "slug": slug, "name": p["name"], "brand": p["brand"], "category": p["category"], "size": p["size"],
            "mrp": p["mrp"], "price": p["price"], "rating": p["rating"], "reviews": p["reviews"],
            "concerns": p["concerns"], "tags": p["tags"], "badge": p.get("badge"),
            "description": p["description"], "bullets": p["bullets"], "howToUse": p["howToUse"], "ingredients": ing,
            "images": [image(s, p["brand"], slug, i) for i, s in enumerate(p["img"])],
        })
    demo_images = {}
    for d in picks.DEMO:
        dp = demo_by_id[d["demo"]]
        assert dp["brand"] == d["brand"] and dp["name"] == d["name"], (d["demo"], dp["name"])
        slug = slugify(f"{bname[dp['brand']]} {dp['name']}")
        demo_images[d["demo"]] = [image(s, d["brand"], slug, i) for i, s in enumerate(d["img"])]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"products": products, "demoImages": demo_images}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    by = {}
    for p in products:
        by[p["brand"]] = by.get(p["brand"], 0) + 1
    print(f"wrote {OUT}: {len(products)} products {by}; demo photos for {len(demo_images)}: {sorted(demo_images)}")


if __name__ == "__main__":
    main()
