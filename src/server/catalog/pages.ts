import "server-only";
import type { ProductCardData } from "@/types/shared";
import { DEALS_MIN_OFF } from "@/components/catalog/search-state";
import { getCatalog, type BrandInfo, type CategoryInfo, type ConcernInfo } from "./data";

/** Page-header data for category / concern / deals landing pages (in memory over the cached snapshot). */

export type CategoryHead = {
  category: CategoryInfo;
  productCount: number;
  brands: BrandInfo[];
  arts: ProductCardData[];
  concerns: ConcernInfo[];
};

export async function getCategoryHead(slug: string): Promise<CategoryHead | null> {
  const snap = await getCatalog();
  const category = snap.categories.find((c) => c.slug === slug);
  if (!category) return null;
  const mine = snap.entries.filter((e) => e.card.categorySlug === slug);
  const brandIds = new Map<string, number>();
  for (const e of mine) brandIds.set(e.card.brand.id, (brandIds.get(e.card.brand.id) ?? 0) + e.pop);
  const brands = snap.brands.filter((b) => brandIds.has(b.id)).sort((a, b) => (brandIds.get(b.id) ?? 0) - (brandIds.get(a.id) ?? 0));
  const arts = [...mine].filter((e) => e.card.image).sort((a, b) => b.pop - a.pop).slice(0, 3).map((e) => e.card);
  return {
    category,
    productCount: mine.length,
    brands,
    arts: arts.length >= 3 ? arts : [...mine].sort((a, b) => b.pop - a.pop).slice(0, 3).map((e) => e.card),
    concerns: snap.concerns.filter((c) => mine.some((e) => e.concerns.includes(c.slug))),
  };
}

export type ConcernHead = { concern: ConcernInfo; productCount: number; brandCount: number; arts: ProductCardData[]; others: ConcernInfo[] };

export async function getConcernHead(slug: string): Promise<ConcernHead | null> {
  const snap = await getCatalog();
  const concern = snap.concerns.find((c) => c.slug === slug);
  if (!concern) return null;
  const mine = snap.entries.filter((e) => e.concerns.includes(slug));
  return {
    concern,
    productCount: mine.length,
    brandCount: new Set(mine.map((e) => e.card.brand.id)).size,
    arts: [...mine].sort((a, b) => Number(!!b.card.image) - Number(!!a.card.image) || b.pop - a.pop).slice(0, 3).map((e) => e.card),
    others: snap.concerns.filter((c) => c.slug !== slug && c.productCount > 0),
  };
}

export type DealsHead = { count: number; maxOff: number; arts: (ProductCardData & { off: number })[]; categories: CategoryInfo[]; hasOwn: boolean };

export async function getDealsHead(): Promise<DealsHead> {
  const snap = await getCatalog();
  const deals = snap.entries.filter((e) => e.off >= DEALS_MIN_OFF && e.card.stock > 0);
  const top = [...deals].sort((a, b) => Number(!!b.card.image) - Number(!!a.card.image) || b.off - a.off).slice(0, 3);
  return {
    count: deals.length,
    maxOff: deals.reduce((m, e) => Math.max(m, e.off), 0),
    arts: top.map((e) => ({ ...e.card, off: e.off })),
    categories: snap.categories.filter((c) => deals.some((e) => e.card.categorySlug === c.slug)),
    hasOwn: deals.some((e) => e.card.brand.isOwn),
  };
}

/** Category tiles for empty states (photo when the category has one). */
export async function getCategoryTiles(): Promise<(CategoryInfo & { top: ProductCardData | null })[]> {
  const snap = await getCatalog();
  return snap.categories.map((c) => ({
    ...c,
    top: snap.entries.filter((e) => e.card.categorySlug === c.slug).sort((a, b) => b.pop - a.pop)[0]?.card ?? null,
  }));
}
