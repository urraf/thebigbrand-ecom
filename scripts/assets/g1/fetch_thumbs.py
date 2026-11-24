"""Download the 400px front image for every shortlisted candidate.

Up to 3 requests in flight, but a global limiter starts at most 1 download per second.
"""
import json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import obf

lock = threading.Lock()
last = [0.0]


def slot():
    with lock:
        wait = 1.02 - (time.time() - last[0])
        if wait > 0:
            time.sleep(wait)
        last[0] = time.time()


def job(item):
    code, url, dest = item
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    slot()
    status, body = obf._get(url, timeout=40)
    if status == 200 and body:
        open(dest, "wb").write(body)
        return True
    print("fail", code, status, url, flush=True)
    return False


def main(suffix=".400.jpg", list_file=None):
    if list_file:
        items = [tuple(l.split("\t")) for l in open(list_file).read().split("\n") if l.strip()]
    else:
        sl = json.load(open(os.path.join(obf.RAW, "shortlist.json")))
        order = sorted(sl.items(), key=lambda kv: ("en:india" not in (kv[1].get("countries_tags") or []), kv[1]["_b"]))
        items = [(c, p["image_front_url"], os.path.join(obf.IMG_DIR, c + suffix)) for c, p in order]
    done = 0
    with ThreadPoolExecutor(3) as ex:
        for ok in ex.map(job, items):
            done += 1
            if done % 50 == 0:
                print(done, flush=True)
    print("done", done)


if __name__ == "__main__":
    main(list_file=sys.argv[1] if len(sys.argv) > 1 else None)
