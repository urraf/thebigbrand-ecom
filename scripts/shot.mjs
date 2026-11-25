#!/usr/bin/env node
/**
 * Screenshot + health check helper for agents and humans (uses the installed Google Chrome via Playwright).
 *
 *   node scripts/shot.mjs <path-or-url> <out.png> [options]
 *
 * Options:
 *   --w=1440 --h=900       viewport (default 1440×900)
 *   --mobile               390×844 phone viewport with touch
 *   --full                 full-page screenshot
 *   --wait=1200            extra ms to wait after load
 *   --as=admin|staff|seller|customer   sign in first with the seeded demo account
 *   --host=seller.localhost:3200       request through a subdomain (seller portal / admin)
 *   --click="css selector" click an element before the screenshot (repeatable)
 *   --fill="css selector=>text"        fill an input before clicking (repeatable)
 *
 * Prints: final URL, HTTP status, console errors, page errors and failed (>=400) requests — fix all of them.
 * Base URL defaults to http://localhost:3200 (override with BASE_URL).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const opt = (name, def) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const many = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(a.indexOf("=") + 1));

const [target, out] = positional;
if (!target || !out) {
  console.error("usage: node scripts/shot.mjs <path-or-url> <out.png> [--w= --h= --mobile --full --wait= --as= --host= --click= --fill=]");
  process.exit(2);
}

const BASE = process.env.BASE_URL || "http://localhost:3200";
const host = opt("host", null);
const base = host ? `http://${host}` : BASE;
const url = /^https?:\/\//.test(target) ? target : base + (target.startsWith("/") ? target : `/${target}`);
const mobile = Boolean(opt("mobile", false));
const viewport = mobile ? { width: 390, height: 844 } : { width: Number(opt("w", 1440)), height: Number(opt("h", 900)) };

const ACCOUNTS = {
  admin: { email: "admin@thebigbrands.co.in", password: "Admin@12345", scope: "admin" },
  staff: { email: "ops@thebigbrands.co.in", password: "Staff@12345", scope: "admin" },
  seller: { email: "seller@glowkart.in", password: "Seller@123", scope: "seller" },
  customer: { email: "priya@example.com", password: "Customer@123", scope: "customer" },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: "en-IN" });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const failed = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const as = opt("as", null);
if (as) {
  const acct = ACCOUNTS[as];
  if (!acct) throw new Error(`unknown --as=${as}`);
  // Reuse a saved session per account+host (avoids the login rate limit when many runs happen in parallel)
  const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
  const sessDir = path.resolve(".shots/.sessions");
  mkdirSync(sessDir, { recursive: true });
  const sessFile = path.join(sessDir, `${as}-${new URL(base).host.replace(/[^a-z0-9.-]/gi, "_")}.json`);
  let reused = false;
  if (existsSync(sessFile)) {
    try {
      await context.addCookies(JSON.parse(readFileSync(sessFile, "utf8")));
      const area = acct.scope === "customer" ? "store" : acct.scope;
      const me = await context.request.get(`${base}/api/v1/auth/me`, { headers: { "x-tbb-scope": area } });
      reused = me.ok() && Boolean((await me.json())?.data?.user);
    } catch { reused = false; }
    if (!reused) await context.clearCookies();
  }
  if (!reused) {
    const res = await context.request.post(`${base}/api/v1/auth/login`, { data: acct });
    if (!res.ok()) console.log(`login as ${as} failed: ${res.status()} ${(await res.text()).slice(0, 200)}`);
    else writeFileSync(sessFile, JSON.stringify(await context.cookies()));
  }
}

let status = null;
try {
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  status = resp?.status() ?? null;
} catch (e) {
  console.log("navigation error:", String(e).slice(0, 200));
}
for (const f of many("fill")) {
  const [sel, text] = f.split("=>");
  try { await page.fill(sel, text ?? "", { timeout: 8000 }); } catch (e) { console.log(`fill failed ${sel}: ${String(e).slice(0, 120)}`); }
}
for (const sel of many("click")) {
  try { await page.click(sel, { timeout: 8000 }); await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); } catch (e) { console.log(`click failed ${sel}: ${String(e).slice(0, 120)}`); }
}
await page.waitForTimeout(Number(opt("wait", 1200)));

mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
await page.screenshot({ path: out, fullPage: Boolean(opt("full", false)) });

console.log(`url: ${page.url()}  status: ${status}  viewport: ${viewport.width}x${viewport.height}`);
console.log(`screenshot: ${path.resolve(out)}`);
console.log(`console errors (${consoleErrors.length}):`, consoleErrors.slice(0, 15));
console.log(`page errors (${pageErrors.length}):`, pageErrors.slice(0, 15));
console.log(`failed requests (${failed.length}):`, failed.slice(0, 15));
await browser.close();
