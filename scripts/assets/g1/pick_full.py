"""Write a download list of full-size images for sheet picks: pick_full.py sheet:idx,idx sheet:idx ..."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf
c = json.load(open(os.path.join(obf.RAW, "candidates.json")))
lines, codes = [], []
for arg in sys.argv[1:]:
    sheet, idxs = arg.split(":")
    m = json.load(open(os.path.join(obf.RAW, "sheets", sheet + ".json")))
    for i in idxs.split(","):
        code = m[i]
        url = c[code]["image_front_url"].replace(".400.jpg", ".full.jpg")
        dest = os.path.join(obf.IMG_DIR, code + ".full.jpg")
        codes.append(code)
        if not os.path.exists(dest):
            lines.append(f"{code}\t{url}\t{dest}")
path = os.path.join(obf.RAW, "full_list.txt")
old = open(path).read().split("\n") if os.path.exists(path) else []
allv = [l for l in old if l.strip()] + [l for l in lines if l not in old]
open(path, "w").write("\n".join(allv) + "\n")
print(len(lines), "new; codes:", ",".join(codes))
