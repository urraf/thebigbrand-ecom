#!/usr/bin/env node
/**
 * Builds prisma/seed-data/credits.json — one entry per external photo the site uses, for the /credits page
 * (CC BY / CC BY-SA require attribution, a licence link and a note that the files were modified).
 *
 *   node scripts/assets/merge/build-credits.mjs          write credits.json
 *   node scripts/assets/merge/build-credits.mjs --check  exit 1 if credits.json is stale or a file is missing
 *
 * Inputs: prisma/seed-data/catalog/*.json (product photos + demoImages), demo-data.cjs (demo product names),
 * ad-images.json (lifestyle photography), merchandising.json (brand banners).
 */
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const seedData = path.join(root, "prisma/seed-data");
const require = createRequire(import.meta.url);
const DEMO = require(path.join(seedData, "demo-data.cjs"));
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

const LICENSE_URLS = {
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
};
const licenseUrl = (license, given) => given || LICENSE_URLS[license] || null;
const brandName = (id) => DEMO.BRANDS.find((b) => b.id === id)?.name ?? id;
const slugify = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const entries = new Map(); // url → entry
const add = (url, entry, usedFor) => {
  const cur = entries.get(url);
  if (cur) {
    if (!cur.usedFor.includes(usedFor)) cur.usedFor.push(usedFor);
    return;
  }
  entries.set(url, { url, ...entry, usedFor: [usedFor] });
};

// ── product photos (Open Beauty Facts) ──
const catalogDir = path.join(seedData, "catalog");
for (const f of readdirSync(catalogDir).filter((x) => x.endsWith(".json")).sort()) {
  const json = readJson(path.join(catalogDir, f));
  const productPhoto = (im, title, slug, usedFor) => {
    const creator = im.attribution || "Open Beauty Facts contributors";
    add(
      im.url,
      {
        kind: "product",
        title,
        productSlug: slug,
        alt: im.alt ?? null,
        source: im.source ?? null,
        sourceUrl: im.sourceUrl ?? null,
        creator,
        license: im.license ?? null,
        licenseUrl: licenseUrl(im.license),
        attribution: `Photo of ${title} by ${creator}, ${im.license}`,
      },
      usedFor,
    );
  };
  for (const p of json.products ?? []) {
    const title = `${brandName(p.brand)} ${p.name}`;
    for (const im of p.images ?? []) productPhoto(im, title, p.slug, `Product: ${title}`);
  }
  for (const [demoId, imgs] of Object.entries(json.demoImages ?? {})) {
    const p = DEMO.PRODUCTS.find((x) => x.id === demoId);
    if (!p) throw new Error(`${f}: demoImages references unknown demo product ${demoId}`);
    const title = `${brandName(p.brand)} ${p.name}`;
    for (const im of imgs) productPhoto(im, title, slugify(title), `Product: ${title}`);
  }
}

// ── lifestyle photography (Wikimedia Commons) ──
const ads = readJson(path.join(seedData, "ad-images.json"));
const merch = existsSync(path.join(seedData, "merchandising.json")) ? readJson(path.join(seedData, "merchandising.json")) : { brandBanners: {} };
/** "title by creator, licence" → title */
const titleOf = (im) => {
  const a = im.attribution ?? "";
  const suffix = ` by ${im.creator}, ${im.license}`;
  if (im.creator && a.endsWith(suffix)) return a.slice(0, -suffix.length);
  const i = a.lastIndexOf(" by ");
  return i > 0 ? a.slice(0, i) : im.alt;
};
const lifestyle = (im, usedFor) =>
  add(
    im.url,
    {
      kind: "lifestyle",
      title: titleOf(im),
      alt: im.alt ?? null,
      source: im.source ?? null,
      sourceUrl: im.sourceUrl ?? null,
      creator: im.creator ?? null,
      license: im.license ?? null,
      licenseUrl: licenseUrl(im.license, im.licenseUrl),
      attribution: im.attribution ?? null,
    },
    usedFor,
  );
const adName = Object.fromEntries(Object.values(DEMO.ADS).flat().map((a) => [a.id, `${brandName(a.brand)} ${a.slot}`]));
for (const [adId, im] of Object.entries(ads.byAd ?? {})) lifestyle(im, `Campaign creative: ${adName[adId] ?? adId}`);
for (const im of ads.video ?? []) lifestyle(im, "Video spot scene (H5)");
for (const im of ads.reels ?? []) lifestyle(im, `Reel cover (H6 ${im.key})`);
for (const [id, im] of Object.entries(ads.concerns ?? {})) lifestyle(im, `Concern tile: ${DEMO.CONCERNS.find((c) => c.id === id)?.name ?? id}`);
for (const [id, im] of Object.entries(ads.categories ?? {})) lifestyle(im, `Category tile: ${DEMO.CATS.find((c) => c.id === id)?.name ?? id}`);
for (const [id, im] of Object.entries(ads.heroes ?? {})) lifestyle(im, `Page hero: ${id}`);
for (const [brand, key] of Object.entries(merch.brandBanners ?? {})) {
  const im = (ads.billboards ?? []).find((x) => x.key === key);
  if (im) lifestyle(im, `Brand store banner: ${brandName(brand)}`);
}
for (const bucket of ["billboards", "cards", "leaderboards"]) for (const im of ads[bucket] ?? []) lifestyle(im, "Media library");
// "Media library" is noise when a photo has a real placement
for (const e of entries.values()) if (e.usedFor.length > 1) e.usedFor = e.usedFor.filter((u) => u !== "Media library");

const images = [...entries.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.url.localeCompare(b.url));
const missing = images.filter((e) => !existsSync(path.join(root, "public", e.url)));
if (missing.length) {
  console.error(`missing on disk:\n  ${missing.map((e) => e.url).join("\n  ")}`);
  process.exit(1);
}
const incomplete = images.filter((e) => !e.sourceUrl || !e.license || !e.licenseUrl || !e.attribution);
if (incomplete.length) {
  console.error(`incomplete credit fields:\n  ${incomplete.map((e) => e.url).join("\n  ")}`);
  process.exit(1);
}

const byLicense = images.reduce((acc, e) => ((acc[e.license] = (acc[e.license] ?? 0) + 1), acc), {});
const out = {
  _note: "Generated by scripts/assets/merge/build-credits.mjs. Do not edit by hand: rerun it after changing catalog/*.json or ad-images.json.",
  modifications: {
    product: "Product photos from Open Beauty Facts were straightened, cut out from their background, re-framed on a white 4:5 canvas, colour-levelled and re-encoded as WebP. Derivatives are shared under the same CC BY-SA 3.0 licence.",
    lifestyle: "Lifestyle photos from Wikimedia Commons were cropped, resized and re-encoded as WebP; a few had small printed marks or logos softened or removed. CC BY-SA derivatives keep their CC BY-SA licence.",
  },
  sources: {
    "Open Beauty Facts": "https://world.openbeautyfacts.org/",
    "Wikimedia Commons": "https://commons.wikimedia.org/",
  },
  licenses: Object.fromEntries(Object.keys(byLicense).sort().map((l) => [l, { url: LICENSE_URLS[l] ?? images.find((e) => e.license === l)?.licenseUrl ?? null, count: byLicense[l] }])),
  counts: { total: images.length, product: images.filter((e) => e.kind === "product").length, lifestyle: images.filter((e) => e.kind === "lifestyle").length },
  images,
};
const file = path.join(seedData, "credits.json");
const text = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (cur !== text) {
    console.error("credits.json is stale — run: node scripts/assets/merge/build-credits.mjs");
    process.exit(1);
  }
  console.log(`credits.json up to date (${images.length} images)`);
} else {
  writeFileSync(file, text);
  console.log(`wrote ${path.relative(root, file)}: ${out.counts.total} images (${out.counts.product} product, ${out.counts.lifestyle} lifestyle) · ${JSON.stringify(byLicense)}`);
}
