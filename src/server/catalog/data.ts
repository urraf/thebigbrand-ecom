import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { discountPct } from "@/lib/money";
import { brandLiteSelect, productCardSelect, toBrandLite, toProductCard } from "@/server/catalog/cards";
import type { BrandLite, ProductCardData } from "@/types/shared";
import { norm, words } from "./text";

/**
 * CATALOGUE SNAPSHOT — every ACTIVE product as a card + search fields, plus the taxonomy (categories, brands,
 * concerns). One cached read ('use cache', long lifetime, invalidated by the products/brands/categories/concerns
 * tags) that search, listings, facets, the brand directory and the sitemap all work from in memory. At this
 * catalogue size (hundreds of SKUs) in-memory matching beats a round-trip per keystroke; past ~20k SKUs this
 * module is the one place to swap in Postgres full-text search.
 */

export type CatalogEntry = {
  card: ProductCardData;
  categoryName: string;
  /** display brand name ("TBB Originals" for the client's own label) */
  brandName: string;
  concerns: string[];
  tags: string[];
  createdAt: number;
  sellerId: string | null;
  /** popularity: bought-in-past-month + rating-weighted review volume */
  pop: number;
  off: number;
  /** normalised word lists per field (search) */
  idx: { name: string[]; brand: string[]; cat: string[]; concern: string[]; tag: string[]; extra: string[] };
  /** normalised "brand name + product name" (phrase match bonus) */
  phrase: string;
  /** normalised tags as phrases */
  tagPhrases: string[];
};

export type CategoryInfo = {
  id: string;
  slug: string;
  name: string;
  short: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type BrandInfo = BrandLite & {
  tagline: string | null;
  description: string | null;
  bannerUrl: string | null;
  followers: number;
  featured: boolean;
  storeActive: boolean;
  productCount: number;
  avgRating: number;
  ratingCount: number;
  /** category slugs this brand sells in */
  categories: string[];
  /** display name ("TBB Originals" for the own label) */
  displayName: string;
};

export type ConcernInfo = {
  slug: string;
  name: string;
  emoji: string | null;
  description: string | null;
  sponsor: BrandLite | null;
  productCount: number;
};

export type CatalogSnapshot = {
  entries: CatalogEntry[];
  categories: CategoryInfo[];
  brands: BrandInfo[];
  concerns: ConcernInfo[];
};

export const OWN_LABEL = "TBB Originals";
export const brandDisplayName = (b: { name: string; isOwn: boolean }) => (b.isOwn ? OWN_LABEL : b.name);

export async function getCatalog(): Promise<CatalogSnapshot> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.brands, TAGS.categories, TAGS.concerns);

  const [rows, categories, brands, concerns] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { ...productCardSelect, tags: true, concerns: true, createdAt: true, sellerId: true, category: { select: { slug: true, name: true, short: true } } },
      orderBy: [{ soldCount: "desc" }, { id: "asc" }],
    }),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { ...brandLiteSelect, tagline: true, description: true, bannerUrl: true, followers: true, featured: true, storeActive: true, storeActiveUntil: true },
    }),
    db.concern.findMany({ orderBy: { sortOrder: "asc" }, include: { sponsorBrand: { select: brandLiteSelect } } }),
  ]);

  const concernName = new Map(concerns.map((c) => [c.slug, c.name]));
  const entries: CatalogEntry[] = rows.map((r) => {
    const card = toProductCard(r);
    const brandName = brandDisplayName(r.brand);
    const meta = (r.meta ?? {}) as { line?: string };
    const concernNames = r.concerns.map((c) => concernName.get(c) ?? c);
    return {
      card,
      categoryName: r.category.name,
      brandName,
      concerns: r.concerns,
      tags: r.tags,
      createdAt: r.createdAt.getTime(),
      sellerId: r.sellerId,
      pop: r.soldCount + (r.reviewCount * r.rating) / 100,
      off: discountPct(r.mrp, r.price),
      idx: {
        name: words(`${r.name} ${meta.line ?? ""}`),
        brand: words(`${r.brand.name} ${r.brand.word ?? ""} ${r.brand.slug}${r.brand.isOwn ? " tbb originals big brands" : ""}`),
        cat: words(`${r.category.name} ${r.category.short ?? ""} ${r.category.slug}`),
        concern: words(`${concernNames.join(" ")} ${r.concerns.join(" ")}`),
        tag: words(r.tags.join(" ")),
        extra: words(`${r.badge ?? ""} ${r.size ?? ""}`),
      },
      phrase: norm(`${r.brand.name} ${r.name}`),
      tagPhrases: r.tags.map(norm).filter(Boolean),
    };
  });

  const now = Date.now();
  const brandInfos: BrandInfo[] = brands.map((b) => {
    const mine = entries.filter((e) => e.card.brand.id === b.id);
    const ratingCount = mine.reduce((a, e) => a + e.card.reviewCount, 0);
    const avg = ratingCount ? mine.reduce((a, e) => a + e.card.rating * e.card.reviewCount, 0) / ratingCount : mine.length ? mine.reduce((a, e) => a + e.card.rating, 0) / mine.length : 0;
    return {
      ...toBrandLite(b),
      tagline: b.tagline,
      description: b.description,
      bannerUrl: b.bannerUrl,
      followers: b.followers,
      featured: b.featured,
      storeActive: b.storeActive && (!b.storeActiveUntil || b.storeActiveUntil.getTime() >= now),
      productCount: mine.length,
      avgRating: Math.round(avg * 10) / 10,
      ratingCount,
      categories: [...new Set(mine.map((e) => e.card.categorySlug))],
      displayName: brandDisplayName(b),
    };
  });

  return {
    entries,
    categories: categories
      .filter((c) => !c.parentId)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        short: c.short || c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        productCount: entries.filter((e) => e.card.categorySlug === c.slug).length,
      })),
    brands: brandInfos,
    concerns: concerns.map((c) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji,
      description: c.description,
      sponsor: c.sponsorBrand ? toBrandLite(c.sponsorBrand) : null,
      productCount: entries.filter((e) => e.concerns.includes(c.slug)).length,
    })),
  };
}

/** Store settings the storefront reads (trending searches, hero images…). */
export type HeroImage = { url: string; alt: string; width: number; height: number };

export async function getStoreSettings(): Promise<{ trending: string[]; heroes: Record<string, HeroImage> }> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  const rows = await db.setting.findMany({ where: { key: { in: ["trending", "heroes"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const trendingRaw = get("trending");
  const trending = Array.isArray(trendingRaw) ? trendingRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 12) : [];
  const heroesRaw = get("heroes");
  const heroes: Record<string, HeroImage> = {};
  if (heroesRaw && typeof heroesRaw === "object" && !Array.isArray(heroesRaw)) {
    for (const [k, v] of Object.entries(heroesRaw as Record<string, unknown>)) {
      const h = v as Partial<HeroImage> | null;
      if (h && typeof h.url === "string" && h.url.startsWith("/")) {
        heroes[k] = { url: h.url, alt: typeof h.alt === "string" ? h.alt : "", width: Number(h.width) || 2400, height: Number(h.height) || 1000 };
      }
    }
  }
  return { trending: trending.length ? trending : DEFAULT_TRENDING, heroes };
}

export const DEFAULT_TRENDING = ["vitamin c serum", "onion hair oil", "sunscreen spf 50", "salicylic face wash", "beard oil", "perfume for men", "kajal", "body lotion"];

/** Public store details (Setting "store": legal name, address, support contacts) for /about and the footer-level pages. */
export type StoreInfo = { name: string; legalName: string; address: string; supportEmail: string; supportPhone: string; gstin: string; grievanceName: string; grievanceEmail: string };

export async function getStoreInfo(): Promise<StoreInfo> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  const row = await db.setting.findUnique({ where: { key: "store" } });
  const v = (row?.value ?? {}) as Partial<Record<keyof StoreInfo, unknown>>;
  const s = (x: unknown, d: string) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 200) : d);
  return {
    name: s(v.name, "The Big Brands"),
    legalName: s(v.legalName, "TBB Retail Pvt Ltd"),
    address: s(v.address, ""),
    supportEmail: s(v.supportEmail, "care@thebigbrands.co.in"),
    supportPhone: s(v.supportPhone, "1800 120 4455"),
    gstin: s(v.gstin, ""),
    grievanceName: s(v.grievanceName, ""),
    grievanceEmail: s(v.grievanceEmail, ""),
  };
}
