"use client";
import { useEffect } from "react";

/**
 * Impression tracker — one tiny singleton for the whole page.
 * Observes every `[data-pz-imp="<campaignId>"]` element (added by AdZone creatives, including content that
 * streams in later). An impression is counted when ≥50% of the creative is in the viewport AND actually
 * visible (not a hidden carousel slide, not inside aria-hidden/inert, tab in foreground) for 1 continuous
 * second — once per campaign per page view. Events are batched and sent with navigator.sendBeacon.
 */
const ENDPOINT = "/api/v1/ads/events";
const TICK = 250;
const VIEW_MS = 1000;

type Entry = { ratio: number; ms: number };
let started = false;
const entries = new Map<Element, Entry>();
const counted = new Set<string>();
let queue: { campaignId: string; type: "impression" }[] = [];
let pageKey = "";
let lastFlush = 0;
let io: IntersectionObserver | null = null;

function shown(el: Element): boolean {
  if (document.visibilityState !== "visible") return false;
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.1;
}

function scan() {
  if (!io) return;
  document.querySelectorAll("[data-pz-imp]").forEach((el) => {
    if (!entries.has(el)) {
      entries.set(el, { ratio: 0, ms: 0 });
      io!.observe(el);
    }
  });
  for (const el of entries.keys()) {
    if (!el.isConnected) {
      io.unobserve(el);
      entries.delete(el);
    }
  }
}

function flush(final = false) {
  if (!queue.length) return;
  lastFlush = Date.now();
  while (queue.length) {
    const batch = queue.slice(0, 50);
    queue = queue.slice(50);
    const body = JSON.stringify({ events: batch });
    let sent = false;
    try {
      sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
    } catch {
      sent = false;
    }
    if (!sent) {
      void fetch(ENDPOINT, { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json" } }).catch(() => {});
    }
    if (!final) break;
  }
}

function tick() {
  const key = location.pathname + location.search;
  if (key !== pageKey) {
    // a new page view: every creative can count again
    pageKey = key;
    counted.clear();
    entries.forEach((e) => (e.ms = 0));
  }
  entries.forEach((en, el) => {
    const id = el.getAttribute("data-pz-imp");
    if (!id || counted.has(id)) return;
    if (en.ratio >= 0.5 && shown(el)) {
      en.ms += TICK;
      if (en.ms >= VIEW_MS) {
        counted.add(id);
        queue.push({ campaignId: id, type: "impression" });
      }
    } else {
      en.ms = 0;
    }
  });
  if (queue.length && (queue.length >= 20 || Date.now() - lastFlush > 2500)) flush();
}

export function ensureTracker() {
  if (started || typeof window === "undefined" || !("IntersectionObserver" in window)) return;
  started = true;
  pageKey = location.pathname + location.search;
  io = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        const en = entries.get(e.target);
        if (en) en.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  scan();
  let t: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(scan, 120);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(tick, TICK);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

/** Rendered by every AdZone (and the inspector) — starts the singleton tracker once. */
export function ZoneTracker() {
  useEffect(() => ensureTracker(), []);
  return null;
}
