"""Name-based pre-filter of OBF candidates before visual screening (g1)."""
import json, os, sys
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".shots", "assets-raw", "g1")
KW = {
 "loreal": ["total repair","hyaluron","extraordinary oil","huile extraordinaire","fall resist","dream length","dream long","glycolic","revitalift","infallible","lash paradise","telescopic","true match","excellence","casting","micellar","men expert","colour protect","color vive","collagen","age perfect","voluminous","bright reveal","paradise","serum","shampoo","conditioner","mascara","foundation","lipstick","color riche","colour riche"],
 "garnier": ["bright complete","vitamin c","micellar","micellaire","micelar","micellair","sakura","super uv","men","turbo","acno","color naturals","black naturals","hair food","fructis","serum mask","tissue mask","sheet mask","hydra bomb","pure active","charcoal","skin naturals","light complete","ultimate blends","honey treasures","olia","ambre solaire","face wash","serum"],
 "nivea": ["soft","creme","crème","cream","body milk","body lotion","cocoa","aloe","men","roll-on","roll on","deodorant","lip","cherry","face wash","shower","micellar","q10","dark spot","milk delights","rich","express","nourish"],
 "dove": ["beauty bar","cream bar","shampoo","conditioner","body wash","deodorant","original","men+care","men care","body lotion","intensive","intense repair","hair fall","nourishing","serum","beauty cream","daily shine","antiperspirant","anti-perspirant","body love","hand cream","whole body"],
 "cetaphil": [""],
}
c = json.load(open(os.path.join(RAW, "candidates.json")))
keep = {}
for code, p in c.items():
    b = p.get("_b")
    if b not in KW: continue
    name = ((p.get("product_name_en") or "") + " " + (p.get("product_name") or "")).lower()
    india = "en:india" in (p.get("countries_tags") or [])
    if india or any(k in name for k in KW[b]):
        keep[code] = p
json.dump(keep, open(os.path.join(RAW, "shortlist.json"), "w"), indent=1)
from collections import Counter
print(len(keep), Counter(p["_b"] for p in keep.values()))
