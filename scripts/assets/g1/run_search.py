"""Run the g1 brand searches against Open Beauty Facts and write a candidate list.

Usage: python3 -I scripts/assets/g1/run_search.py [extra search terms ...]
Writes .shots/assets-raw/g1/candidates.json (deduplicated by barcode).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf  # noqa: E402

BRAND_TAGS = {
    "loreal": ["l-oreal-paris", "l-oreal", "loreal-paris", "loreal"],
    "garnier": ["garnier"],
    "nivea": ["nivea", "nivea-men"],
    "dove": ["dove"],
    "cetaphil": ["cetaphil"],
}


def brand_query(tag, country=None, page=1, size=100):
    p = {
        "action": "process",
        "tagtype_0": "brands", "tag_contains_0": "contains", "tag_0": tag,
        "sort_by": "unique_scans_n", "page_size": str(size), "page": str(page),
    }
    if country:
        p.update({"tagtype_1": "countries", "tag_contains_1": "contains", "tag_1": country})
    return p


def main():
    out_path = os.path.join(obf.RAW, "candidates.json")
    cands = json.load(open(out_path)) if os.path.exists(out_path) else {}
    tasks = []
    for brand, tags in BRAND_TAGS.items():
        for tag in tags:
            tasks.append((brand, f"{tag}-in", brand_query(tag, "india")))
        tasks.append((brand, f"{tags[0]}-p1", brand_query(tags[0], None, 1)))
        tasks.append((brand, f"{tags[0]}-p2", brand_query(tags[0], None, 2)))
    for term in sys.argv[1:]:
        brand = term.split()[0].lower().replace("'", "").replace("l oreal", "loreal")
        tasks.append((brand, "q-" + term.replace(" ", "_")[:40],
                      {"search_terms": term, "search_simple": "1", "page_size": "50"}))
    for brand, label, params in tasks:
        data = obf.search(params, label)
        n = 0
        for p in data.get("products", []):
            code = p.get("code")
            if not code or not p.get("image_front_url"):
                continue
            if code not in cands:
                p["_brand"] = brand
                cands[code] = p
                n += 1
        print(f"{label:40s} count={data.get('count')} new={n}")
    json.dump(cands, open(out_path, "w"), indent=1)
    print("total candidates", len(cands))


if __name__ == "__main__":
    main()
