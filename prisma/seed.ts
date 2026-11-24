/**
 * The Big Brands — database seed (bootstrap).
 * Run: npm run db:seed   (wipes and recreates all demo data — local/dev only)
 *
 * Sources:
 *  - prisma/seed-data/demo-data.cjs      approved demo catalogue, brands, ad inventory & creatives
 *  - prisma/seed-data/catalog/*.json     real catalogue: { products (with photos), demoImages (photos for demo products by demo id) }
 *                                        supplement.json adds photo-less listings (SVG packshot) for thinly covered brands
 *  - prisma/seed-data/ad-images.json     licensed lifestyle photography → campaign creatives (byAd, video scenes, reels,
 *                                        concern tiles), category tiles, brand store banners, page heroes, media library
 *  - prisma/seed-data/credits.json       generated photo credits (node scripts/assets/merge/build-credits.mjs) — not read here
 *
 * Every /media file referenced by the inputs is checked on disk before anything is wiped, and every file
 * referenced by the seeded rows is checked again at the end. The seed is deterministic and idempotent.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PricingModel, type Prisma } from "../src/generated/prisma/client";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DEMO = require("./seed-data/demo-data.cjs");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// deterministic pseudo-random so the seed is reproducible
let _s = 42;
const rnd = () => ((_s = (_s * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);
const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const FONT_MAP: Record<string, string> = {
  "'DM Serif Display', serif": "var(--font-dmserif), serif",
  "'Geist', sans-serif": "var(--font-geist), sans-serif",
  "'Instrument Serif', serif": "var(--font-instrument), serif",
  "'Bricolage Grotesque', sans-serif": "var(--font-bricolage), sans-serif",
  "'Bebas Neue', sans-serif": "var(--font-bebas), sans-serif",
  "'Syne', sans-serif": "var(--font-syne), sans-serif",
};

const MODEL_MAP: Record<string, PricingModel> = { day: "DAY", week: "WEEK", month: "MONTH", cpm: "CPM", cpc: "CPC", clip: "CLIP", box: "BOX" };

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  skin: "Serums, moisturisers and sunscreens from dermatologist-trusted brands.",
  face: "Face washes and cleansers for every skin type.",
  hair: "Shampoos and conditioners for repair, shine and scalp care.",
  oil: "Coconut, onion, bhringraj and ayurvedic hair oils.",
  makeup: "Lipsticks, kajal and foundations that last all day.",
  body: "Body washes and lotions for soft, nourished skin.",
  men: "Beard care, face washes and grooming essentials for men.",
  fragrance: "Long-lasting perfumes at honest prices.",
};

const COPY: Record<string, { d: string; u: string; i: string; bullets: string[] }> = {
  face: { d: "A gentle everyday cleanser that lifts away dirt, oil and city pollution without stripping your skin’s natural moisture barrier.", u: "Massage onto damp skin for 30–60 seconds, then rinse with lukewarm water. Use morning and night.", i: "Aqua, Glycerin, Coco-Glucoside, Niacinamide, Aloe Barbadensis Leaf Juice, Panthenol.", bullets: ["Removes dirt, oil and pollution", "Soap-free, pH-balanced formula", "Suitable for daily use", "Dermatologically tested"] },
  hair: { d: "A nourishing formula that cleanses gently while repairing damage, reducing breakage and leaving hair soft, shiny and manageable.", u: "Apply to wet hair, massage into a rich lather, rinse thoroughly. Follow with conditioner.", i: "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Keratin, Argan Oil, Fragrance.", bullets: ["Repairs damaged hair", "Reduces breakage and frizz", "Adds shine and softness", "Safe for colour-treated hair"] },
  oil: { d: "A lightweight, non-sticky hair oil that nourishes the scalp, strengthens roots and helps reduce hair fall with regular use.", u: "Warm a few drops between palms and massage into scalp. Leave for 1 hour or overnight, then wash.", i: "Cocos Nucifera Oil, Allium Cepa Extract, Bhringraj Extract, Vitamin E.", bullets: ["Nourishes scalp and roots", "Non-sticky, lightweight", "Helps reduce hair fall", "Traditional Indian ingredients"] },
  skin: { d: "A targeted daily treatment that hydrates, evens tone and strengthens the skin barrier for a visibly healthier glow.", u: "Apply 2–3 drops to clean skin, morning and evening. Follow with moisturiser and SPF in the day.", i: "Aqua, Niacinamide, Sodium Hyaluronate, Zinc PCA, Ceramide NP, Panthenol.", bullets: ["Hydrates and plumps", "Evens skin tone", "Strengthens the skin barrier", "Non-comedogenic"] },
  body: { d: "Rich, fast-absorbing body care that locks in moisture for up to 48 hours, leaving skin soft and smooth.", u: "Apply generously after a shower on slightly damp skin. Use daily.", i: "Aqua, Glycerin, Shea Butter, Almond Oil, Vitamin E, Fragrance.", bullets: ["48-hour moisture", "Fast-absorbing, non-greasy", "With shea butter & vitamin E", "For dry to very dry skin"] },
  makeup: { d: "Long-wearing colour with a comfortable, weightless feel. Transfer-resistant and enriched with nourishing oils.", u: "Apply directly or with a brush. Build up for more intense colour.", i: "Ricinus Communis Seed Oil, Cera Alba, Tocopherol, Pigments.", bullets: ["Long-lasting colour", "Smudge and transfer resistant", "Lightweight feel", "Enriched with vitamin E"] },
  men: { d: "Grooming essentials made for Indian men — tackles tan, oil and beard care with natural actives.", u: "Use daily as part of your grooming routine.", i: "Aqua, Charcoal, Coffee Extract, Vitamin E, Argan Oil.", bullets: ["Made for men’s skin", "Natural actives", "Daily use", "Fresh, masculine fragrance"] },
  fragrance: { d: "A long-lasting eau de parfum with a rich, layered scent that stays with you all day.", u: "Spray on pulse points — wrists, neck and behind the ears.", i: "Alcohol Denat., Parfum, Aqua.", bullets: ["Lasts 8+ hours", "Rich, layered notes", "Travel-friendly bottle", "Luxury at an honest price"] },
};

const REVIEWERS = [
  ["Ananya Iyer", "Pune"], ["Rohit Mehra", "Gurugram"], ["Sneha Kapoor", "Mumbai"], ["Arjun Nair", "Kochi"], ["Fatima Khan", "Lucknow"],
  ["Priyanka Das", "Kolkata"], ["Karan Singh", "Jaipur"], ["Meera Pillai", "Chennai"], ["Aditya Rao", "Bengaluru"], ["Nisha Verma", "Delhi"],
  ["Vikram Joshi", "Ahmedabad"], ["Ritika Bansal", "Chandigarh"], ["Sana Sheikh", "Hyderabad"], ["Deepak Yadav", "Indore"], ["Kavya Menon", "Thiruvananthapuram"],
];
type ReviewLine = [number, string, string];
const REVIEW_LINES: ReviewLine[] = [
  [5, "Absolutely love it", "Genuine product, fast delivery and the free TBB gift was a lovely surprise. Will order again."],
  [5, "Works as promised", "Been using it for three weeks and I can see a real difference. Packaging was perfect."],
  [4, "Good value", "Does what it says. Slightly pricey at MRP but the discount here makes it worth it."],
  [5, "My holy grail", "Third time ordering. Always authentic and the free mini gift is a nice touch."],
  [3, "Okay for the price", "Decent product, results are slow. Delivery was quick though."],
  [5, "Original product", "Checked the batch code on the brand website and it is genuine. Packed well with bubble wrap."],
];
const REVIEW_LINES_BY_CAT: Record<string, ReviewLine[]> = {
  skin: [
    [5, "Recommended by my dermatologist", "Bought it here because it was cheaper than the pharmacy and 100% genuine."],
    [4, "Nice texture", "Lightweight and absorbs quickly. Took a star off only because the cap is a bit fiddly."],
    [5, "Skin feels smoother", "Using it every night for a month and my skin feels noticeably smoother and more even."],
  ],
  face: [
    [5, "Gentle cleanse", "Does not leave my face tight or dry, even in winter. A little goes a long way."],
    [4, "Good for oily skin", "Controls shine for a few hours. Lathers nicely without feeling harsh."],
  ],
  hair: [
    [5, "Soft, shiny hair", "Hair feels noticeably softer after just a few washes and tangles far less."],
    [4, "Good lather", "Nice fragrance and lathers well. Slightly drying if I skip conditioner."],
  ],
  oil: [
    [5, "Non-sticky", "Washes out easily and my scalp feels nourished. Using it twice a week before hair wash."],
    [4, "Light and pleasant", "No heavy feeling at all. Results take time but my hair feels stronger."],
  ],
  makeup: [
    [5, "Stays all day", "Lasted through a full office day without touching up. Shade is true to the photo."],
    [4, "Lovely finish", "Blends easily and looks natural. Slightly drying by evening but nothing major."],
  ],
  body: [
    [5, "So moisturising", "My skin stays soft all day, even in Delhi winters."],
    [4, "Non-greasy", "Absorbs fast and the fragrance is pleasant, not overpowering."],
  ],
  men: [
    [5, "Bought for my husband", "He has been using it daily and likes how fresh it feels."],
    [4, "Does the job", "Simple, effective grooming product. Good value with the discount."],
  ],
  fragrance: [
    [5, "Compliments all day", "Lasts six to seven hours on me and I keep getting asked what I am wearing."],
    [4, "Smells expensive", "Great projection for the price. Softens a little after the first few hours."],
  ],
};

async function wipe() {
  // child → parent order
  const tables = [
    "AdStatDaily", "Payment", "CouponUse", "CouponClip", "OrderEvent", "OrderGift", "SellerLedgerEntry", "OrderItem", "Payout", "Order",
    "CartItem", "Cart", "WishlistItem", "Review", "GiftItem", "GiftTier", "ProductImage", "AdCampaign", "Advertiser", "AdSlot",
    "Coupon", "Product", "Concern", "Category", "Seller", "Address", "Session", "OtpCode", "AuditLog", "Media", "SearchQuery",
    "Subscriber", "Setting", "Brand", "User",
  ];
  for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t}"`);
}

type CatalogImage = { url: string; alt?: string; width?: number; height?: number; source?: string; sourceUrl?: string; license?: string; attribution?: string };
type CatalogProduct = {
  slug?: string; name: string; brand: string; category: string; size?: string; mrp: number; price: number;
  rating?: number; reviews?: number; concerns?: string[]; tags?: string[]; badge?: string | null; description?: string;
  howToUse?: string; ingredients?: string; bullets?: string[]; images?: CatalogImage[];
  // packshot fallback + listing state (supplement listings without photos)
  shape?: string; colorPrimary?: string; colorSecondary?: string; status?: "ACTIVE" | "PENDING";
};
type Catalog = { products: CatalogProduct[]; demoImages: Record<string, CatalogImage[]> };

/** Real catalogue: every prisma/seed-data/catalog/*.json → { products, demoImages (photos for demo products, by demo id) }. */
function loadCatalog(): Catalog {
  const dir = path.join(__dirname, "seed-data", "catalog");
  const out: Catalog = { products: [], demoImages: {} };
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const json = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    out.products.push(...((Array.isArray(json) ? json : json.products ?? []) as CatalogProduct[]));
    for (const [demoId, imgs] of Object.entries((json.demoImages ?? {}) as Record<string, CatalogImage[]>)) {
      out.demoImages[demoId] = [...(out.demoImages[demoId] ?? []), ...imgs];
    }
  }
  return out;
}

/** Licensed lifestyle photography (see ad-images.json `_note`). */
type LifestyleImage = { url: string; width?: number; height?: number; alt: string; source?: string; sourceUrl?: string; creator?: string; license?: string; licenseUrl?: string; attribution?: string; key?: string };
type AdImages = {
  billboards: LifestyleImage[]; cards: LifestyleImage[]; leaderboards: LifestyleImage[]; video: LifestyleImage[]; reels: LifestyleImage[];
  categories: Record<string, LifestyleImage>; concerns: Record<string, LifestyleImage>; heroes: Record<string, LifestyleImage>; byAd: Record<string, LifestyleImage>;
};
function loadAdImages(): AdImages {
  const empty: AdImages = { billboards: [], cards: [], leaderboards: [], video: [], reels: [], categories: {}, concerns: {}, heroes: {}, byAd: {} };
  const file = path.join(__dirname, "seed-data", "ad-images.json");
  if (!existsSync(file)) return empty;
  return { ...empty, ...JSON.parse(readFileSync(file, "utf8")) };
}
const lifestyleList = (a: AdImages) =>
  [...a.billboards, ...a.cards, ...a.leaderboards, ...a.video, ...a.reels, ...Object.values(a.categories), ...Object.values(a.concerns), ...Object.values(a.heroes), ...Object.values(a.byAd)]
    .filter((im, i, arr) => arr.findIndex((x) => x.url === im.url) === i);

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const mediaExists = (url: string) => !url.startsWith("/") || existsSync(path.join(PUBLIC_DIR, decodeURI(url.split("?")[0])));

/** Fail before wiping anything if a catalogue / lifestyle file is missing on disk. */
function assertMediaOnDisk(catalog: Catalog, adImages: AdImages) {
  const urls = [
    ...catalog.products.flatMap((p) => (p.images ?? []).map((im) => im.url)),
    ...Object.values(catalog.demoImages).flatMap((imgs) => imgs.map((im) => im.url)),
    ...lifestyleList(adImages).map((im) => im.url),
  ];
  const missing = urls.filter((u) => !mediaExists(u));
  if (missing.length) throw new Error(`Seed aborted (nothing wiped): ${missing.length} media file(s) missing under public/:\n  ${missing.join("\n  ")}`);
  return urls.length;
}

/** Merchandising choices (brand banners, creative products, sponsored products) — prisma/seed-data/merchandising.json. */
type Merchandising = { brandBanners: Record<string, string>; adProducts: Record<string, string[]>; sponsoredProducts: string[]; cartAddons: string[] };
const MERCH: Merchandising = {
  brandBanners: {}, adProducts: {}, sponsoredProducts: [], cartAddons: [],
  ...(existsSync(path.join(__dirname, "seed-data", "merchandising.json")) ? JSON.parse(readFileSync(path.join(__dirname, "seed-data", "merchandising.json"), "utf8")) : {}),
};

/** Packshot fallback for catalogue photos (shown only if a photo is removed in admin). */
function inferShape(name: string, category: string): string {
  const n = name.toLowerCase();
  if (/lipstick|kajal|lip balm|concealer|mascara|roll-on|stick/.test(n)) return "stick";
  if (/serum|dropper|toner|essence/.test(n) && !/foundation|cream|crème/.test(n)) return "dropper";
  if (/face wash|gel|sunscreen|cc cream|scrub|paste|tube/.test(n)) return "tube";
  if (/creme|crème|cream|butter|hair food|mask|moisturi[sz]er|balm|bar|soap/.test(n)) return "jar";
  if (/body wash|lotion|foundation|pump|shower/.test(n)) return "pump";
  return category === "makeup" ? "stick" : "bottle";
}


async function main() {
  console.log("Seeding The Big Brands…");
  const catalog = loadCatalog();
  const adImages = loadAdImages();
  const checked = assertMediaOnDisk(catalog, adImages);
  const known = new Set([...(DEMO.PRODUCTS as { id: string }[]).map((p) => p.id), ...catalog.products.filter((p) => p.status !== "PENDING").map((p) => p.slug ?? "")]);
  const badRefs = [...Object.values(MERCH.adProducts).flat(), ...MERCH.sponsoredProducts, ...MERCH.cartAddons].filter((r) => !known.has(r));
  if (badRefs.length) throw new Error(`Seed aborted (nothing wiped): merchandising.json references unknown or non-live products: ${badRefs.join(", ")}`);
  console.log(`  ${catalog.products.length} catalogue items · ${Object.keys(catalog.demoImages).length} demo photo sets · ${checked} media references found on disk`);
  await wipe();

  // ── users ──
  const adminPw = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin@12345", 10);
  const admin = await db.user.create({ data: { email: (process.env.SEED_ADMIN_EMAIL || "admin@thebigbrands.co.in").toLowerCase(), name: "Rahul Bansal", role: "ADMIN", passwordHash: adminPw, phone: "9000000001" } });
  await db.user.create({ data: { email: "ops@thebigbrands.co.in", name: "Neha Gupta", role: "STAFF", passwordHash: await bcrypt.hash("Staff@12345", 10), phone: "9000000002" } });
  const customerPw = await bcrypt.hash("Customer@123", 10);
  const priya = await db.user.create({
    data: {
      email: "priya@example.com", phone: "9876543210", name: "Priya Sharma", role: "CUSTOMER", passwordHash: customerPw,
      addresses: { create: { label: "Home", name: "Priya Sharma", phone: "9876543210", line1: "C-42, Second Floor", line2: "Malviya Nagar", city: "New Delhi", state: "Delhi", pincode: "110017", isDefault: true } },
    },
  });
  const customers = [priya];
  for (const [name, city] of REVIEWERS.slice(0, 10)) {
    const phone = `98${between(10000000, 99999999)}`;
    customers.push(await db.user.create({
      data: { name, phone, role: "CUSTOMER", addresses: { create: { name, phone, line1: `${between(1, 300)}, ${pick(["MG Road", "Park Street", "Lake View", "Sector 15", "Civil Lines"])}`, city, state: pick(["Maharashtra", "Karnataka", "Delhi", "Tamil Nadu", "Kerala", "Uttar Pradesh"]), pincode: String(between(110001, 700099)), isDefault: true } } },
    }));
  }

  // ── sellers ──
  const sellerPw = await bcrypt.hash("Seller@123", 10);
  const mkSeller = async (s: { email: string; name: string; business: string; display: string; city: string; state: string; status: "APPROVED" | "PENDING" | "REJECTED"; brands: string[]; cats: string[]; reason?: string }) => {
    const user = await db.user.create({ data: { email: s.email, name: s.name, role: "SELLER", passwordHash: sellerPw, phone: `97${between(10000000, 99999999)}` } });
    return db.seller.create({
      data: {
        userId: user.id, slug: slugify(s.display), businessName: s.business, displayName: s.display, contactName: s.name, email: s.email, phone: user.phone!,
        gstin: `07AAB${between(1000, 9999)}C1Z${between(1, 9)}`, pan: `AAB${between(1000, 9999)}C`, addressLine: `${between(1, 99)}, Industrial Area Phase ${between(1, 3)}`, city: s.city, state: s.state, pincode: String(between(110001, 600099)),
        bankAccountName: s.business, bankAccountNumber: String(between(10000000, 99999999)) + String(between(1000, 9999)), bankIfsc: `HDFC000${between(1000, 9999)}`,
        categories: s.cats, brandsAuthorised: s.brands, description: `${s.display} is an authorised distributor of ${s.brands.join(", ")}.`,
        status: s.status, rejectionReason: s.reason ?? null, commissionPct: 12, approvedAt: s.status === "APPROVED" ? daysAgo(60) : null,
      },
    });
  };
  const glowkart = await mkSeller({ email: "seller@glowkart.in", name: "Amit Khanna", business: "GlowKart Distributors Pvt Ltd", display: "GlowKart", city: "New Delhi", state: "Delhi", status: "APPROVED", brands: ["Beardo", "Bella Vita"], cats: ["men", "fragrance"] });
  const herbal = await mkSeller({ email: "seller@herbalroots.in", name: "Lakshmi Iyer", business: "Herbal Roots India LLP", display: "Herbal Roots", city: "Bengaluru", state: "Karnataka", status: "APPROVED", brands: ["Biotique", "Himalaya"], cats: ["oil", "face", "body"] });
  await mkSeller({ email: "apply@urbanglow.in", name: "Rakesh Jain", business: "Urban Glow Traders", display: "Urban Glow", city: "Jaipur", state: "Rajasthan", status: "PENDING", brands: ["Plum", "Minimalist"], cats: ["skin", "face"] });
  await mkSeller({ email: "apply@beautyhub.in", name: "Sonal Patel", business: "BeautyHub Wholesale", display: "BeautyHub", city: "Ahmedabad", state: "Gujarat", status: "PENDING", brands: ["Lakmé"], cats: ["makeup"] });

  // ── taxonomy ──
  const cats: Record<string, string> = {};
  for (const [i, c] of (DEMO.CATS as { id: string; name: string; short: string }[]).entries()) {
    const row = await db.category.create({ data: { slug: c.id, name: c.name, short: c.short, sortOrder: i, description: CATEGORY_DESCRIPTIONS[c.id], imageUrl: adImages.categories[c.id]?.url ?? null } });
    cats[c.id] = row.id;
  }

  const brands: Record<string, string> = {};
  for (const [i, b] of (DEMO.BRANDS as Record<string, unknown>[]).entries()) {
    const row = await db.brand.create({
      data: {
        slug: b.id as string, name: b.name as string, word: (b.word as string) ?? null, sub: (b.sub as string) ?? null,
        color: b.color as string, accent: (b.accent as string) ?? null, font: FONT_MAP[b.font as string] ?? "var(--font-geist), sans-serif",
        fontWeight: Number(b.weight ?? 700), textTransform: (b.tt as string) ?? "none", letterSpacing: (b.ls as string) ?? "0", italic: Boolean(b.italic),
        tagline: (b.tagline as string) ?? null, description: `Shop authentic ${b.name} products on The Big Brands — sourced directly from the brand and authorised distributors.`,
        isOwn: Boolean(b.own), featured: !b.own, storeActive: !b.own && i < 11, storeActiveUntil: daysAhead(25), followers: between(4000, 180000), sortOrder: i,
        bannerUrl: adImages.billboards.find((x) => x.key === MERCH.brandBanners[b.id as string])?.url ?? null,
      },
    });
    brands[b.id as string] = row.id;
  }

  for (const [i, c] of (DEMO.CONCERNS as { id: string; name: string; emoji: string; sponsor: string }[]).entries()) {
    await db.concern.create({ data: { slug: c.id, name: c.name, emoji: c.emoji, sponsorBrandId: brands[c.sponsor] ?? null, sortOrder: i } });
  }

  // ── products ──
  const productIds: Record<string, string> = {}; // demo id → db id
  const refIds: Record<string, string> = {}; // demo id or catalogue slug → db id
  const refSlugs: Record<string, string> = {}; // demo id or catalogue slug → product slug (for /p/ links)
  const brandRows = DEMO.BRANDS as { id: string; name: string; color: string; accent?: string }[];
  type Seeded = { id: string; brand: string; hasPhoto: boolean; badge: string | null; reviews: number; active: boolean };
  const seeded: Seeded[] = [];
  const sellerFor = (brand: string) => (brand === "beardo" || brand === "bellavita" ? glowkart.id : brand === "biotique" ? herbal.id : null);
  for (const p of DEMO.PRODUCTS as Record<string, unknown>[]) {
    const own = Boolean(p.own);
    const copy = COPY[p.cat as string] ?? COPY.skin;
    const photos = own ? [] : catalog.demoImages[p.id as string] ?? [];
    const row = await db.product.create({
      data: {
        slug: own ? slugify(`tbb ${p.name}`) : slugify(`${brandRows.find((b) => b.id === p.brand)?.name} ${p.name}`),
        name: p.name as string, brandId: brands[p.brand as string], categoryId: cats[p.cat as string], sellerId: sellerFor(p.brand as string),
        sku: `TBB-${(p.id as string).toUpperCase()}`, size: (p.size as string) ?? null, mrp: p.mrp as number, price: p.price as number,
        stock: between(25, 400), status: "ACTIVE", description: copy.d, howToUse: copy.u, ingredients: copy.i, bullets: copy.bullets,
        concerns: (p.concerns as string[]) ?? [], tags: [p.cat as string, ...((p.concerns as string[]) ?? [])], badge: (p.tag as string) ?? null,
        // SVG packshot fields stay as the fallback even when a real photo is attached
        shape: p.shape as string, colorPrimary: p.c1 as string, colorSecondary: p.c2 as string,
        rating: Number(p.rating ?? 4.3), reviewCount: Number(p.reviews ?? 500), soldCount: Math.max(80, Math.round(Number(p.reviews ?? 500) / 12)),
        isFeatured: Boolean(p.tag), isOwnLabel: own, meta: own ? { line: String(p.line ?? "") } : undefined,
        // real photos for demo products (catalog/*.json → demoImages)
        images: photos.length ? { create: photos.map((im, i) => ({ ...im, sortOrder: i })) } : undefined,
      },
    });
    productIds[p.id as string] = row.id;
    refIds[p.id as string] = row.id;
    refSlugs[p.id as string] = row.slug;
    seeded.push({ id: row.id, brand: p.brand as string, hasPhoto: photos.length > 0, badge: (p.tag as string) ?? null, reviews: row.reviewCount, active: true });
  }

  // real catalogue (photos) + supplement listings — added on top of the demo catalogue
  const skipped: string[] = [];
  const skuSeq: Record<string, number> = {};
  for (const c of catalog.products) {
    const brandId = brands[c.brand] ?? (await db.brand.findFirst({ where: { name: { equals: c.brand, mode: "insensitive" } } }))?.id;
    const categoryId = cats[c.category];
    const slug = c.slug ?? slugify(`${c.brand} ${c.name}`);
    if (!brandId || !categoryId) { skipped.push(`${slug} (unknown brand/category ${c.brand}/${c.category})`); continue; }
    if (refSlugs[slug] || (await db.product.findUnique({ where: { slug }, select: { id: true } }))) { skipped.push(`${slug} (duplicate slug)`); continue; }
    const copy = COPY[c.category] ?? COPY.skin;
    const brand = brandRows.find((b) => b.id === c.brand);
    const status = c.status === "PENDING" ? "PENDING" : "ACTIVE";
    const reviewCount = c.reviews ?? between(200, 9000);
    skuSeq[c.brand] = (skuSeq[c.brand] ?? 0) + 1;
    const row = await db.product.create({
      data: {
        slug, name: c.name, brandId, categoryId, sellerId: sellerFor(c.brand), size: c.size ?? null, mrp: c.mrp, price: c.price,
        sku: `TBB-${c.brand.toUpperCase().slice(0, 6)}-${String(skuSeq[c.brand]).padStart(3, "0")}`,
        stock: status === "PENDING" ? between(60, 180) : between(20, 300), status, description: c.description ?? copy.d, howToUse: c.howToUse ?? copy.u,
        ingredients: c.ingredients ?? copy.i, bullets: c.bullets ?? copy.bullets, concerns: c.concerns ?? [], tags: c.tags ?? [],
        badge: c.badge ?? null, rating: status === "PENDING" ? 0 : c.rating ?? 4.2, reviewCount: status === "PENDING" ? 0 : reviewCount,
        soldCount: status === "PENDING" ? 0 : Math.max(80, Math.round(reviewCount / 12)),
        shape: c.shape ?? inferShape(c.name, c.category), colorPrimary: c.colorPrimary ?? brand?.color ?? null, colorSecondary: c.colorSecondary ?? brand?.accent ?? null,
        images: c.images?.length ? { create: c.images.map((im, i) => ({ ...im, sortOrder: i })) } : undefined,
      },
    });
    refIds[slug] = row.id;
    refSlugs[slug] = slug;
    seeded.push({ id: row.id, brand: c.brand, hasPhoto: Boolean(c.images?.length), badge: c.badge ?? null, reviews: reviewCount, active: status === "ACTIVE" });
  }
  if (skipped.length) console.warn(`  skipped ${skipped.length} catalogue item(s):\n    ${skipped.join("\n    ")}`);

  // curated "featured" set: the top 2 live products per brand, preferring real photos, then merit badges (not "New"), then popularity.
  // (featured products lead brand shelves and creative fallbacks — see src/server/ads/serve.ts brandBestsellers)
  const merit = (s: Seeded) => Number(Boolean(s.badge) && s.badge !== "New");
  const featured = Object.values(
    seeded.filter((s) => s.active).reduce<Record<string, Seeded[]>>((acc, s) => ((acc[s.brand] ??= []).push(s), acc), {}),
  ).flatMap((list) => list.sort((a, b) => Number(b.hasPhoto) - Number(a.hasPhoto) || merit(b) - merit(a) || b.reviews - a.reviews).slice(0, 2).map((s) => s.id));
  await db.product.updateMany({ data: { isFeatured: false } });
  await db.product.updateMany({ where: { id: { in: featured } }, data: { isFeatured: true } });

  const ref = (r: string) => refIds[r] ?? null;
  const productHref = (r: string) => (refSlugs[r] ? `/p/${refSlugs[r]}` : null);
  // demo links point at demo ids ("#/p/derma-sal") → real product slugs
  const fixLink = (href: string) => {
    const h = href.replace(/^#/, "");
    const m = h.match(/^\/p\/([^/?#]+)/);
    return m && refSlugs[m[1]] ? `/p/${refSlugs[m[1]]}` : h;
  };

  // ── free gifts ──
  for (const [i, g] of (DEMO.TBB_GIFTS as Record<string, unknown>[]).entries()) {
    await db.giftItem.create({
      data: { productId: productIds[g.id as string], miniName: g.name as string, miniSize: g.mini as string, worth: g.worth as number, stock: [420, 312, 38, 586, 207, 640][i] ?? 200, sortOrder: i },
    });
  }
  await db.giftTier.createMany({ data: [{ minAmount: 0, giftCount: 1 }, { minAmount: 999, giftCount: 2 }, { minAmount: 1999, giftCount: 3 }] });

  // ── reviews ──
  const allProducts = await db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, category: { select: { slug: true } } }, orderBy: { sku: "asc" } });
  for (const p of allProducts) {
    const n = between(2, 4);
    const pool = REVIEW_LINES_BY_CAT[p.category.slug] ?? [];
    for (let k = 0; k < n; k++) {
      const [name, city] = pick(REVIEWERS);
      const [rating, title, body] = pool.length && rnd() < 0.55 ? pick(pool) : pick(REVIEW_LINES);
      await db.review.create({ data: { productId: p.id, authorName: name, city, rating, title, body, verified: rnd() > 0.2, helpful: between(0, 140), createdAt: daysAgo(between(2, 120)) } });
    }
  }

  // ── coupons ──
  for (const c of DEMO.COUPONS as Record<string, string>[]) {
    const isPct = c.value.includes("%");
    const val = parseInt(c.value.replace(/\D/g, ""), 10) || 0;
    const min = parseInt((c.min.match(/₹([\d,]+)/)?.[1] ?? "0").replace(/,/g, ""), 10);
    await db.coupon.create({
      data: {
        code: `${c.brand.toUpperCase().slice(0, 6)}${val || "BOGO"}`, title: c.value, description: c.min,
        type: c.value.includes("Buy 1") ? "BOGO" : isPct ? "PERCENT" : "FLAT", value: val, minOrder: min,
        brandId: brands[c.brand], endsAt: daysAhead(between(4, 12)), isSponsored: true, clipCount: between(300, 4000), perUserLimit: 1,
      },
    });
  }
  await db.coupon.createMany({
    data: [
      { code: "WELCOME10", title: "10% off", description: "on your first order", type: "PERCENT", value: 10, maxDiscount: 200, minOrder: 299, perUserLimit: 1 },
      { code: "LOVEDIT", title: "20% off TBB Originals", description: "full-size version of your free gift", type: "PERCENT", value: 20, brandId: brands.tbb, minOrder: 0, perUserLimit: 3 },
      { code: "FLAT100", title: "₹100 off", description: "on ₹999+", type: "FLAT", value: 100, minOrder: 999, perUserLimit: 2 },
    ],
  });

  // ── ad inventory ──
  const slotIds: Record<string, string> = {};
  for (const [i, s] of (DEMO.SLOTS as Record<string, unknown>[]).entries()) {
    const row = await db.adSlot.create({
      data: {
        code: s.id as string, page: s.page as string, name: s.name as string, format: s.format as string, size: s.size as string,
        pricingModel: MODEL_MAP[s.model as string], rate: s.rate as number, positions: s.units as number, potentialMonthly: s.est as number,
        bookable: Boolean(s.bookable), sortOrder: i, description: s.format as string,
      },
    });
    slotIds[s.id as string] = row.id;
  }

  const advertisers: Record<string, string> = {};
  const advertiserFor = async (brandSlug: string) => {
    if (advertisers[brandSlug]) return advertisers[brandSlug];
    const b = (DEMO.BRANDS as { id: string; name: string }[]).find((x) => x.id === brandSlug)!;
    const row = await db.advertiser.create({ data: { companyName: `${b.name} India`, contactName: pick(["Ritu Sharma", "Manish Gupta", "Anjali Rao", "Siddharth Jain"]), email: `marketing@${brandSlug}.example`, brandId: brands[brandSlug] } });
    advertisers[brandSlug] = row.id;
    return row.id;
  };

  let cmp = 2000;
  const slotRate = async (code: string) => db.adSlot.findUniqueOrThrow({ where: { code } });
  /** extra.meta is merged into the creative meta (imageAlt, dealPrice…), everything else in extra overrides. */
  const mkCampaign = async (code: string, a: Record<string, unknown>, extra: Partial<Prisma.AdCampaignUncheckedCreateInput> & { image?: LifestyleImage | null } = {}) => {
    const slot = await slotRate(code);
    const brandSlug = a.brand as string;
    const house = Boolean(a.house) || brandSlug === "tbb";
    const { image: extraImage, meta: extraMeta, ...rest } = extra;
    const img = extraImage === undefined ? adImages.byAd[a.id as string] ?? null : extraImage;
    const refs = MERCH.adProducts[a.id as string] ?? [a.product as string, ...((a.products as string[]) ?? [])];
    const meta: Record<string, unknown> = {
      ...(a.dealPrice ? { dealPrice: a.dealPrice } : {}),
      ...(img ? { imageAlt: img.alt } : {}),
      ...((extraMeta as Record<string, unknown> | undefined) ?? {}),
    };
    return db.adCampaign.create({
      data: {
        code: `CMP-${++cmp}`, name: `${brandRows.find((b) => b.id === brandSlug)?.name ?? brandSlug} · ${slot.name}`,
        slotId: slot.id, advertiserId: house ? null : await advertiserFor(brandSlug), brandId: brands[brandSlug], isHouse: house, status: "APPROVED",
        kicker: (a.kicker as string) ?? null, headline: a.headline as string, subline: (a.sub as string) ?? null, ctaLabel: (a.cta as string) ?? "Shop now",
        linkUrl: fixLink((a.href as string) ?? `/brand/${brandSlug}`), imageUrl: img?.url ?? null,
        theme: (a.theme as Prisma.InputJsonValue) ?? undefined, layout: (a.layout as string) ?? null,
        productIds: refs.filter(Boolean).map(ref).filter((v): v is string => Boolean(v)).filter((v, i, arr) => arr.indexOf(v) === i),
        startsAt: daysAgo(between(5, 25)), endsAt: daysAhead(between(6, 30)), pricingModel: slot.pricingModel, rate: slot.rate,
        budget: slot.pricingModel === "CPM" || slot.pricingModel === "CPC" ? between(20000, 80000) : 0, paymentStatus: house ? "WAIVED" : "PAID",
        approvedById: admin.id, approvedAt: daysAgo(between(5, 25)), priority: house ? 0 : 10,
        meta: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : undefined,
        ...rest,
      },
    });
  };

  const videoScenes = [...adImages.video].sort((x, y) => (x.key ?? "").localeCompare(y.key ?? ""));
  for (const [code, list] of Object.entries(DEMO.ADS as Record<string, Record<string, unknown>[]>)) {
    for (const a of list) {
      if (code === "H5" && videoScenes.length) {
        // simulated 30 s spot: the scene photos play in order; imageUrl is the poster/fallback frame
        await mkCampaign(code, a, {
          meta: { scenes: videoScenes.map((s) => s.url), sceneAlts: videoScenes.map((s) => s.alt), poster: adImages.byAd[a.id as string]?.url ?? videoScenes[0].url },
        });
      } else await mkCampaign(code, a);
    }
  }
  for (const r of DEMO.REELS as Record<string, unknown>[]) {
    const poster = adImages.reels.find((x) => x.key === r.id) ?? null; // 9:16 cover frame
    await mkCampaign("H6", { id: r.id, brand: r.brand, headline: r.title, product: r.product }, {
      image: poster, linkUrl: null,
      meta: { creator: String(r.creator), handle: String(r.handle), views: String(r.views), colors: r.colors as string[], ...(poster ? { poster: poster.url } : {}) },
    });
  }
  for (const c of DEMO.CONCERNS as { id: string; name: string; sponsor: string }[]) {
    const tile = adImages.concerns[c.id] ?? null; // square tile
    await mkCampaign("H4", { brand: c.sponsor, headline: `${c.name} edit`, href: `/s?concern=${c.id}` }, { targetKey: c.id, image: tile });
  }
  for (const s of DEMO.SEARCH_ADS as { brand: string; keywords: string[]; text: string; href: string }[]) {
    await mkCampaign("S1", { brand: s.brand, headline: s.text, href: s.href }, { keywords: s.keywords, image: null });
  }
  // sponsored products (S3 search, P1 product page, C1 cart add-ons) — the product photo is the creative
  const productAd = async (code: "S3" | "P1" | "C1", r: string) => {
    const p = await db.product.findUniqueOrThrow({ where: { id: ref(r)! }, select: { id: true, name: true, brand: { select: { slug: true } } } });
    await mkCampaign(code, { brand: p.brand.slug, headline: p.name, product: r, href: productHref(r) }, { targetKey: p.id, image: null });
  };
  for (const r of MERCH.sponsoredProducts) {
    await productAd("S3", r);
    await productAd("P1", r);
  }
  for (const r of MERCH.cartAddons) await productAd("C1", r);
  // the pending self-serve booking from the demo (Plum on H3) — waiting for admin approval
  const plumAdv = await advertiserFor("plum");
  const h3 = await slotRate("H3");
  const plumArt = adImages.leaderboards.find((x) => x.key === "citrus");
  await db.adCampaign.create({
    data: {
      code: "CMP-1042", name: "Plum · Leaderboard Strip", slotId: h3.id, advertiserId: plumAdv, brandId: brands.plum, status: "PENDING_REVIEW",
      kicker: "Sponsored", headline: "Plum Green Tea — clear skin, naturally", subline: "Flat 20% off this week", ctaLabel: "Shop Plum", linkUrl: "/brand/plum",
      imageUrl: plumArt?.url ?? null, meta: plumArt ? { imageAlt: plumArt.alt } : undefined,
      theme: { bg: "linear-gradient(120deg,#3a0d52,#6a1b9a 60%,#9c4dcc)", fg: "#ffffff", accent: "#ffd36b" },
      productIds: ["plum-gt", "plum-green-tea-oil-free-moisturiser"].map(ref).filter((v): v is string => Boolean(v)),
      startsAt: daysAhead(1), endsAt: daysAhead(8), pricingModel: h3.pricingModel, rate: h3.rate, budget: 14000, paymentStatus: "PAID",
    },
  });

  // ── 30 days of ad stats ──
  const campaigns = await db.adCampaign.findMany({ where: { status: "APPROVED" }, include: { slot: true }, orderBy: { code: "asc" } });
  for (const c of campaigns) {
    let imps = 0, clicks = 0, spent = 0;
    const days = Math.min(30, Math.max(1, Math.round((Date.now() - c.startsAt.getTime()) / 864e5)));
    for (let d = days; d >= 1; d--) {
      const base = { H1: 9000, H2: 5000, H3: 7000, H4: 2500, H5: 4000, H6: 3000, H7: 2000, H8: 4500, H10: 6000, H11: 3500, S1: 2200, S2: 3000, S3: 1800, S4: 1500, P1: 1400, P2: 2000, C1: 900, C2: 1100 }[c.slot.code] ?? 1000;
      const i = Math.round(base * (0.7 + rnd() * 0.6));
      const ctr = c.slot.pricingModel === "CPC" ? 0.03 + rnd() * 0.03 : 0.008 + rnd() * 0.02;
      const k = Math.round(i * ctr);
      const spend = { DAY: c.rate, WEEK: c.rate / 7, MONTH: c.rate / 30, CPM: (i / 1000) * c.rate, CPC: k * c.rate, CLIP: k * c.rate, BOX: 0 }[c.pricingModel];
      const s = Math.round((c.isHouse ? 0 : spend) * 100) / 100;
      await db.adStatDaily.create({ data: { campaignId: c.id, date: new Date(new Date(daysAgo(d)).toISOString().slice(0, 10)), impressions: i, clicks: k, spend: s } });
      imps += i; clicks += k; spent += s;
    }
    await db.adCampaign.update({ where: { id: c.id }, data: { impressions: imps, clicks, spent: Math.round(spent * 100) / 100 } });
  }

  // ── order history ──
  const sellable = await db.product.findMany({ where: { status: "ACTIVE", isOwnLabel: false }, include: { brand: true, images: { take: 1, orderBy: { sortOrder: "asc" } } }, orderBy: { sku: "asc" } });
  const gifts = await db.giftItem.findMany({ orderBy: { sortOrder: "asc" } });
  const statuses = ["DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "PACKED", "CONFIRMED", "PLACED", "CANCELLED"] as const;
  for (let n = 0; n < 48; n++) {
    const user = n < 6 ? priya : pick(customers);
    const addr = await db.address.findFirst({ where: { userId: user.id } });
    const lines = Array.from({ length: between(1, 4) }, () => pick(sellable)).filter((v, i, a) => a.indexOf(v) === i);
    const items = lines.map((p) => ({ p, qty: between(1, 2) }));
    const subtotal = items.reduce((a, l) => a + l.p.price * l.qty, 0);
    const mrpTotal = items.reduce((a, l) => a + l.p.mrp * l.qty, 0);
    const shippingFee = subtotal >= 499 ? 0 : 49;
    const status = pick([...statuses]);
    const created = daysAgo(between(0, 60));
    const giftCount = subtotal >= 1999 ? 3 : subtotal >= 999 ? 2 : 1;
    const chosen = [...gifts].sort(() => rnd() - 0.5).slice(0, giftCount);
    const cod = rnd() < 0.3;
    const order = await db.order.create({
      data: {
        number: `TBB${created.toISOString().slice(2, 10).replace(/-/g, "")}${String(1000 + n)}`, userId: user.id, status,
        paymentMethod: cod ? "COD" : "RAZORPAY", paymentStatus: status === "CANCELLED" ? "REFUNDED" : cod && status !== "DELIVERED" ? "COD_PENDING" : "PAID",
        mrpTotal, subtotal, shippingFee, total: subtotal + shippingFee,
        shipName: addr!.name, shipPhone: addr!.phone, shipLine1: addr!.line1, shipLine2: addr!.line2, shipCity: addr!.city, shipState: addr!.state, shipPincode: addr!.pincode,
        placedAt: created, createdAt: created, deliveredAt: status === "DELIVERED" ? new Date(created.getTime() + 3 * 864e5) : null,
        items: {
          create: items.map(({ p, qty }) => {
            const commissionPct = p.sellerId ? 12 : 0;
            const lineTotal = p.price * qty;
            const commissionAmt = Math.round((lineTotal * commissionPct) / 100);
            return {
              productId: p.id, sellerId: p.sellerId, name: p.name, brandName: p.brand.name, size: p.size, imageUrl: p.images[0]?.url ?? null,
              mrp: p.mrp, price: p.price, qty, lineTotal, status: status === "CANCELLED" ? "CANCELLED" : status === "DELIVERED" ? "DELIVERED" : status === "SHIPPED" ? "SHIPPED" : status === "PACKED" ? "PACKED" : status === "CONFIRMED" ? "CONFIRMED" : "PLACED",
              commissionPct, commissionAmt, sellerEarning: p.sellerId ? lineTotal - commissionAmt : 0,
              courier: ["SHIPPED", "DELIVERED"].includes(status) ? "Delhivery" : null, trackingNumber: ["SHIPPED", "DELIVERED"].includes(status) ? `DLV${between(100000000, 999999999)}` : null,
            };
          }),
        },
        gifts: { create: chosen.map((g) => ({ giftItemId: g.id, name: g.miniName, miniSize: g.miniSize, worth: g.worth })) },
        events: { create: [{ status: "PLACED", actor: "customer", createdAt: created }, ...(status !== "PLACED" ? [{ status, actor: "system", createdAt: new Date(created.getTime() + 864e5) }] : [])] },
        payments: { create: { provider: cod ? "COD" : "RAZORPAY", amount: subtotal + shippingFee, status: cod && status !== "DELIVERED" ? "COD_PENDING" : status === "CANCELLED" ? "REFUNDED" : "PAID", providerOrderId: `order_seed_${n}_${between(1000, 9999)}`, providerPaymentId: cod ? null : `pay_seed_${between(100000, 999999)}` } },
      },
      include: { items: true },
    });
    // seller ledger for delivered seller items
    for (const it of order.items) {
      if (!it.sellerId || it.status !== "DELIVERED") continue;
      await db.sellerLedgerEntry.createMany({
        data: [
          { sellerId: it.sellerId, type: "SALE_CREDIT", amount: it.lineTotal, orderItemId: it.id, note: `Order ${order.number}`, createdAt: order.deliveredAt! },
          { sellerId: it.sellerId, type: "COMMISSION_DEBIT", amount: -it.commissionAmt, orderItemId: it.id, note: `${it.commissionPct}% commission · ${order.number}`, createdAt: order.deliveredAt! },
        ],
      });
    }
  }
  // one completed payout per approved seller
  for (const s of [glowkart, herbal]) {
    const bal = await db.sellerLedgerEntry.aggregate({ where: { sellerId: s.id }, _sum: { amount: true } });
    const amount = Math.floor(((bal._sum.amount ?? 0) * 0.6) / 100) * 100;
    if (amount > 0) {
      const payout = await db.payout.create({ data: { sellerId: s.id, amount, status: "PAID", reference: `UTR${between(100000000, 999999999)}`, periodStart: daysAgo(60), periodEnd: daysAgo(15), paidAt: daysAgo(12) } });
      await db.sellerLedgerEntry.create({ data: { sellerId: s.id, type: "PAYOUT", amount: -amount, payoutId: payout.id, note: `Payout ${payout.reference}`, createdAt: daysAgo(12) } });
    }
  }

  // ── settings ──
  await db.setting.createMany({
    data: [
      { key: "store", value: { name: "The Big Brands", legalName: "TBB Retail Pvt Ltd", gstin: "07AAKCT4821M1Z5", supportEmail: "care@thebigbrands.co.in", supportPhone: "1800 120 4455" } },
      { key: "shipping", value: { freeShippingMin: 499, shippingFee: 49, codEnabled: true, codFee: 0, partner: "Shiprocket" } },
      { key: "trending", value: DEMO.TRENDING },
      // page hero photography (advertise / sell / free-gift store), editable like any setting
      ...(Object.keys(adImages.heroes).length
        ? [{ key: "heroes", value: Object.fromEntries(Object.entries(adImages.heroes).map(([k, im]) => [k, { url: im.url, alt: im.alt, width: im.width ?? null, height: im.height ?? null }])) }]
        : []),
    ],
  });

  // ── media library: the licensed lifestyle photos, so admins can reuse them in campaigns ──
  const library = lifestyleList(adImages);
  if (library.length) {
    await db.media.createMany({
      data: library.map((im) => ({
        url: im.url, mime: "image/webp", size: statSync(path.join(PUBLIC_DIR, im.url)).size, width: im.width ?? null, height: im.height ?? null,
        alt: im.alt, uploadedById: admin.id,
      })),
    });
  }

  // ── verify: every /media file the database references exists on disk ──
  const [imgRows, cmpRows, catRows, brandRows2, itemRows, mediaRows] = await Promise.all([
    db.productImage.findMany({ select: { url: true } }),
    db.adCampaign.findMany({ select: { imageUrl: true, mobileImageUrl: true, meta: true } }),
    db.category.findMany({ select: { imageUrl: true } }),
    db.brand.findMany({ select: { bannerUrl: true, logoUrl: true } }),
    db.orderItem.findMany({ select: { imageUrl: true } }),
    db.media.findMany({ select: { url: true } }),
  ]);
  const metaUrls = (m: unknown) => {
    const o = (m && typeof m === "object" ? m : {}) as { scenes?: unknown; poster?: unknown };
    return [...(Array.isArray(o.scenes) ? o.scenes : []), o.poster].filter((u): u is string => typeof u === "string");
  };
  const referenced = [
    ...imgRows.map((r) => r.url), ...cmpRows.flatMap((r) => [r.imageUrl, r.mobileImageUrl, ...metaUrls(r.meta)]), ...catRows.map((r) => r.imageUrl),
    ...brandRows2.flatMap((r) => [r.bannerUrl, r.logoUrl]), ...itemRows.map((r) => r.imageUrl), ...mediaRows.map((r) => r.url),
  ].filter((u): u is string => Boolean(u));
  const missing = [...new Set(referenced.filter((u) => !mediaExists(u)))];
  if (missing.length) throw new Error(`Seeded rows reference ${missing.length} missing file(s):\n  ${missing.join("\n  ")}`);

  const [products, active, pending, withPhotos, images, brandsN, bannered, campaignsN, imaged, categoriesImaged, orders, users] = await Promise.all([
    db.product.count(), db.product.count({ where: { status: "ACTIVE" } }), db.product.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { images: { some: {} } } }), db.productImage.count(), db.brand.count(), db.brand.count({ where: { bannerUrl: { not: null } } }),
    db.adCampaign.count(), db.adCampaign.count({ where: { imageUrl: { not: null } } }), db.category.count({ where: { imageUrl: { not: null } } }),
    db.order.count(), db.user.count(),
  ]);
  console.log(
    `Done: ${products} products (${active} live, ${pending} pending approval, ${withPhotos} with real photos · ${images} images) · ` +
      `${brandsN} brands (${bannered} with store banners) · ${categoriesImaged} category images · ${campaignsN} campaigns (${imaged} with imagery) · ` +
      `${orders} orders · ${users} users · ${new Set(referenced).size} media references verified on disk`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
