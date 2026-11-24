"""Polite image downloader for group g3 (<= 1 request/second, back-off on 429/5xx).

Usage: python3 -I obf_download.py <list.tsv>
list.tsv lines: <name>\t<url>   -> saved to .shots/assets-raw/g3/img/<name>
"""
import os, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
OUT = os.path.join(ROOT, ".shots", "assets-raw", "g3", "img")
UA = "TheBigBrandsCatalog/1.0 (marketplace catalogue build)"
GAP = 1.1
_last = [0.0]


def fetch(url):
    delay = 15
    for attempt in range(5):
        d = time.time() - _last[0]
        if d < GAP:
            time.sleep(GAP - d)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429 or e.code >= 500:
                print("  HTTP %d, back-off %ds" % (e.code, delay), file=sys.stderr)
                time.sleep(delay); delay *= 2; continue
            print("  HTTP %d %s" % (e.code, url), file=sys.stderr)
            return None
        except Exception as e:
            print("  error %s, back-off %ds" % (e, delay), file=sys.stderr)
            time.sleep(delay); delay *= 2
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    ok = miss = 0
    for line in open(sys.argv[1]):
        line = line.strip()
        if not line or "\t" not in line:
            continue
        name, url = line.split("\t", 1)
        path = os.path.join(OUT, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        data = fetch(url)
        if not data:
            miss += 1; print("MISS", name); continue
        with open(path, "wb") as f:
            f.write(data)
        ok += 1
    print("downloaded", ok, "missing", miss)


if __name__ == "__main__":
    main()
