#!/usr/bin/env python3
"""Fetch the other raw photos uploaded for a product (not only the selected front image).

Contributors often upload several shots; sometimes a cleaner front than the one selected.
  alts.py thumbs <code> [<code> ...]   -> downloads every raw image at 400 px to raw/alt/<code>_<id>.jpg
  alts.py full   <code>_<id> [...]     -> downloads the full-size raw image to raw/img/<code>_<id>.jpg
Raw image URL: https://images.openbeautyfacts.org/images/products/<split code>/<id>[.400].jpg
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf  # noqa: E402

ALT = os.path.join(obf.RAW, "alt")
os.makedirs(ALT, exist_ok=True)


def split(code):
    if len(code) <= 8:
        return code
    return f"{code[0:3]}/{code[3:6]}/{code[6:9]}/{code[9:]}"


def images_of(code):
    for f in glob.glob(os.path.join(obf.CACHE, "*.json")):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        for p in d.get("products") or []:
            if p.get("code") == code and p.get("images"):
                return p["images"]
        if d.get("code") == code and (d.get("product") or {}).get("images"):
            return d["product"]["images"]
    return {}


def thumbs(code):
    ims = images_of(code)
    out = []
    for k in sorted((k for k in ims if k.isdigit()), key=int):
        dest = os.path.join(ALT, f"{code}_{k}.jpg")
        if not os.path.exists(dest):
            url = f"https://images.openbeautyfacts.org/images/products/{split(code)}/{k}.400.jpg"
            data = obf._get(url, "img", 1.1, binary=True)
            if not data:
                continue
            open(dest, "wb").write(data)
        out.append(dest)
    return out


def full(key):
    code, k = key.rsplit("_", 1)
    dest = os.path.join(obf.IMG, f"{key}.jpg")
    if os.path.exists(dest):
        return dest
    url = f"https://images.openbeautyfacts.org/images/products/{split(code)}/{k}.jpg"
    data = obf._get(url, "img", 1.1, binary=True)
    if data:
        open(dest, "wb").write(data)
        return dest
    return None


if __name__ == "__main__":
    mode, rest = sys.argv[1], sys.argv[2:]
    if mode == "thumbs":
        for c in rest:
            print(c, len(thumbs(c)), flush=True)
    elif mode == "full":
        for k in rest:
            print(k, full(k), flush=True)
