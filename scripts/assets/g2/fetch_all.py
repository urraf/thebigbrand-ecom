#!/usr/bin/env python3
"""Download the front image (full size, fallback 400px) for every candidate in candidates.json."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf  # noqa: E402

cands = json.load(open(os.path.join(obf.RAW, "candidates.json")))
for i, c in enumerate(cands, 1):
    path = obf.fetch(c["code"], c["image_front_url"])
    print(f"[{i}/{len(cands)}] {c['code']} {'ok' if path else 'FAIL'}", flush=True)
