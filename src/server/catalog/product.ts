import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { BrandLite, ImageLite, ProductCardData } from "@/types/shared";
import { brandDisplayName, getCatalog, type CatalogEntry } from "./data";

/**
 * PRODUCT DETAIL reads (all cached, tag-invalidated). Only ACTIVE products are visible to shoppers:
 * getProductDetail() returns null for unknown / draft / pending / rejected / archived slugs → notFound().
 */

export type ProductDetail = {
  card: ProductCardData;
  images: ImageLite[];
  brand: BrandLite & { tagline: string | null; displayName: string; storeActive: boolean };
  category: { slug: string; name: string };
  /** null = sold by The Big Brands Retail */
  seller: { slug: string; displayName: string } | null;
  description: string | null;
  howToUse: string | null;
  ingredients: string | null;
  bullets: string[];
  concerns: { slug: string; name: string; emoji: string | null }[];
  tags: string[];
  sku: string | null;
  /** bestseller rank by units in its category (non own-label), 0 when not ranked */
  rank: number;
  updatedAt: string;
};

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.product(slug));
  const clean = String(slug || "").toLowerCase().slice(0, 160);
  if (!/^[a-z0-9-]+$/.test(clean)) return null;
  const p = await db.product.findUnique({
    where: { slug: clean },
    select: {
      ...productCardSelect,
      status: true,
      sku: true,
      description: true,
      howToUse: true,
      ingredients: true,
      bullets: true,
      concerns: true,
      tags: true,
      updatedAt: true,
      images: { select: { url: true, alt: true, width: true, height: true }, orderBy: { sortOrder: "asc" } },
      brand: { select: { id: true, slug: true, name: true, word: true, sub: true, color: true, accent: true, font: true, fontWeight: true, textTransform: true, letterSpacing: true, italic: true, isOwn: true, logoUrl: true, tagline: true, storeActive: true } },
      category: { select: { slug: true, name: true } },
      seller: { select: { slug: true, displayName: true, status: true } },
    },
  });
  if (!p || p.status !== "ACTIVE") return null;
  cacheTag(TAGS.product(p.id));
  const [concerns, snap] = await Promise.all([
    p.concerns.length ? db.concern.findMany({ where: { slug: { in: p.concerns } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } }) : Promise.resolve([]),
    getCatalog(),
  ]);
  const { tagline, storeActive, ...brandLite } = p.brand;
  const ranked = snap.entries.filter((e) => e.card.categorySlug === p.category.slug && !e.card.isOwnLabel).sort((a, b) => b.card.soldCount - a.card.soldCount);
  const rank = p.isOwnLabel ? 0 : ranked.findIndex((e) => e.card.id === p.id) + 1;
  return {
    card: toProductCard({ ...p, images: p.images.slice(0, 1) }),
    images: p.images,
    brand: { ...brandLite, tagline, storeActive, displayName: brandDisplayName(p.brand) },
    category: p.category,
    seller: p.seller && p.seller.status === "APPROVED" ? { slug: p.seller.slug, displayName: p.seller.displayName } : null,
    description: p.description,
    howToUse: p.howToUse,
    ingredients: p.ingredients,
    bullets: p.bullets,
    concerns,
    tags: p.tags,
    sku: p.sku,
    rank,
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ───────────────────────────── reviews ─────────────────────────────

export type ReviewView = {
  id: string;
  authorName: string;
  city: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  helpful: number;
  createdAt: string;
};

export type ReviewSummary = {
  /** published written reviews */
  count: number;
  /** average of the written reviews */
  average: number;
  /** counts for 5★ … 1★ */
  histogram: [number, number, number, number, number];
  reviews: ReviewView[];
};

export async function getProductReviews(productId: string, opts: { limit?: number; sort?: "top" | "recent" } = {}): Promise<ReviewSummary> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.reviews(productId));
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const where = { productId, isPublished: true };
  const [groups, rows] = await Promise.all([
    db.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    db.review.findMany({
      where,
      orderBy: opts.sort === "recent" ? [{ createdAt: "desc" }] : [{ helpful: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true, authorName: true, city: true, rating: true, title: true, body: true, verified: true, helpful: true, createdAt: true },
    }),
  ]);
  const histogram: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let count = 0;
  for (const g of groups) {
    const r = Math.max(1, Math.min(5, g.rating));
    histogram[5 - r] += g._count._all;
    sum += r * g._count._all;
    count += g._count._all;
  }
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    histogram,
    reviews: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

// ───────────────────────────── recommendations ─────────────────────────────

/** Categories that go together (for "frequently bought together" and "compare with similar"). */
const RELATED: Record<string, string[]> = {
  face: ["skin"],
  skin: ["face", "body"],
  hair: ["oil"],
  oil: ["hair"],
  makeup: ["face", "skin"],
  body: ["skin"],
  men: ["face", "fragrance"],
  fragrance: ["men", "body"],
};

export type Recommendations = { together: ProductCardData[]; similar: ProductCardData[] };

/**
 * Frequently bought together: real co-purchases from orders first, topped up with complementary bestsellers
 * from related categories. Compare: same category, closest price first, then related categories.
 */
export async function getRecommendations(productId: string): Promise<Recommendations> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products, TAGS.product(productId));
  const snap = await getCatalog();
  const me = snap.entries.find((e) => e.card.id === productId);
  if (!me) return { together: [], similar: [] };
  const live = (e: CatalogEntry) => e.card.id !== productId && e.card.stock > 0;

  // co-purchases (orders that contained this product)
  const orderIds = (await db.orderItem.findMany({ where: { productId }, select: { orderId: true }, take: 500, orderBy: { id: "desc" } })).map((o) => o.orderId);
  const co = orderIds.length
    ? await db.orderItem.groupBy({ by: ["productId"], where: { orderId: { in: orderIds }, productId: { not: productId } }, _count: { _all: true } })
    : [];
  const coCount = new Map(co.map((c) => [c.productId, c._count._all]));
  const byId = new Map(snap.entries.map((e) => [e.card.id, e]));

  const rel = RELATED[me.card.categorySlug] ?? [];
  const maxPop = Math.max(1, ...snap.entries.map((e) => e.pop));
  const complement = (e: CatalogEntry) =>
    (coCount.get(e.card.id) ?? 0) * 10 +
    (rel.includes(e.card.categorySlug) ? 3 : 0) +
    (e.card.categorySlug !== me.card.categorySlug ? 1 : 0) +
    (e.concerns.some((c) => me.concerns.includes(c)) ? 2 : 0) +
    (e.card.brand.id === me.card.brand.id ? 1.5 : 0) +
    e.pop / maxPop;
  const pool = snap.entries.filter((e) => live(e) && !e.card.isOwnLabel && byId.has(e.card.id));
  const ranked = [...pool].sort((a, b) => complement(b) - complement(a));
  const together: CatalogEntry[] = [];
  for (const e of ranked) {
    if (together.length >= 2) break;
    if (together.some((t) => t.card.categorySlug === e.card.categorySlug) && ranked.length > 4) continue;
    together.push(e);
  }
  for (const e of ranked) if (together.length < 2 && !together.includes(e)) together.push(e);

  const near = (a: CatalogEntry, b: CatalogEntry) => Math.abs(a.card.price - me.card.price) - Math.abs(b.card.price - me.card.price);
  const same = pool.filter((e) => e.card.categorySlug === me.card.categorySlug).sort((a, b) => (b.concerns.some((c) => me.concerns.includes(c)) ? 1 : 0) - (a.concerns.some((c) => me.concerns.includes(c)) ? 1 : 0) || near(a, b));
  const relList = pool.filter((e) => rel.includes(e.card.categorySlug)).sort(near);
  const similar = [...new Set([...same, ...relList])].filter((e) => !together.includes(e) || same.length + relList.length <= 5).slice(0, 3);

  return { together: together.map((e) => e.card), similar: similar.map((e) => e.card) };
}

/** All ACTIVE product slugs (+ last update) for the sitemap. */
export async function listProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products);
  return db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true }, orderBy: { soldCount: "desc" } });
}
