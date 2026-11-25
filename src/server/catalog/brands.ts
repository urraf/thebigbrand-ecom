import "server-only";
import type { ProductCardData } from "@/types/shared";
import { getCatalog, type BrandInfo, type CatalogEntry, type ConcernInfo } from "./data";

/** Brand directory + brand store reads (in memory over the cached catalogue snapshot). */

export type BrandTile = BrandInfo & { top: ProductCardData[] };

/** Brand groups for the directory filter chips (category slugs per group). */
export const BRAND_GROUPS: [string, string, string[]][] = [
  ["all", "All brands", []],
  ["skin", "Skincare", ["skin", "face"]],
  ["hair", "Haircare", ["hair", "oil"]],
  ["makeup", "Makeup", ["makeup"]],
  ["body", "Bath & Body", ["body"]],
  ["men", "Men", ["men"]],
  ["fragrance", "Fragrance", ["fragrance"]],
];

export function brandGroupsOf(b: Pick<BrandInfo, "categories">): string[] {
  return BRAND_GROUPS.filter(([g, , cats]) => g !== "all" && cats.some((c) => b.categories.includes(c))).map(([g]) => g);
}

const byPop = (a: CatalogEntry, b: CatalogEntry) => b.pop - a.pop;

export async function getBrandDirectory(): Promise<BrandTile[]> {
  const snap = await getCatalog();
  return snap.brands
    .filter((b) => b.productCount > 0)
    .map((b) => ({
      ...b,
      top: snap.entries
        .filter((e) => e.card.brand.id === b.id)
        .sort(byPop)
        .slice(0, 3)
        .map((e) => e.card),
    }))
    .sort((a, b) => Number(b.isOwn) - Number(a.isOwn) || a.displayName.localeCompare(b.displayName));
}

export type BrandStoreTab = "all" | "best" | "new" | "price";
export const BRAND_TABS: [BrandStoreTab, string][] = [
  ["all", "All products"],
  ["best", "Bestsellers"],
  ["new", "New arrivals"],
  ["price", "Price: low → high"],
];

export type BrandStore = {
  brand: BrandInfo;
  products: ProductCardData[];
  /** ids of the top-3 bestsellers (rank labels) */
  bestIds: string[];
  concerns: ConcernInfo[];
  similar: BrandTile[];
};

export async function getBrandStore(slug: string, tab: BrandStoreTab = "all"): Promise<BrandStore | null> {
  const snap = await getCatalog();
  const brand = snap.brands.find((b) => b.slug === slug);
  if (!brand) return null;
  const mine = snap.entries.filter((e) => e.card.brand.id === brand.id);
  const sorted = [...mine].sort(
    tab === "best"
      ? (a, b) => b.card.soldCount - a.card.soldCount
      : tab === "new"
        ? (a, b) => b.createdAt - a.createdAt
        : tab === "price"
          ? (a, b) => a.card.price - b.card.price
          : (a, b) => Number(b.card.stock > 0) - Number(a.card.stock > 0) || byPop(a, b),
  );
  const bestIds = [...mine].sort((a, b) => b.card.soldCount - a.card.soldCount).slice(0, 3).map((e) => e.card.id);
  const cats = new Set(brand.categories);
  const similar = snap.brands
    .filter((x) => x.id !== brand.id && !x.isOwn && x.productCount > 0)
    .map((x) => ({ x, s: x.categories.filter((c) => cats.has(c)).length * 10 + (x.storeActive ? 4 : 0) + (x.featured ? 2 : 0) + x.avgRating }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ x }) => ({
      ...x,
      top: snap.entries
        .filter((e) => e.card.brand.id === x.id)
        .sort(byPop)
        .slice(0, 2)
        .map((e) => e.card),
    }));
  return {
    brand,
    products: sorted.map((e) => e.card),
    bestIds,
    concerns: snap.concerns.filter((c) => mine.some((e) => e.concerns.includes(c.slug))),
    similar,
  };
}
