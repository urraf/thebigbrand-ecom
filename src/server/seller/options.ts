import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";

/** Catalogue lookups for seller forms (same for everyone → cached). */

export type OptionCategory = { id: string; slug: string; name: string };
export type OptionBrand = { id: string; slug: string; name: string };
export type OptionConcern = { slug: string; name: string; emoji: string | null };
export type OptionSlot = { code: string; name: string; page: string; pricingModel: string; rate: number; isActive: boolean; description: string | null };

export async function getCategoryOptions(): Promise<OptionCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.categories);
  return db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } });
}

/** Third-party brands a seller can be authorised for (TBB's own label is never sold by sellers). */
export async function getBrandOptions(): Promise<OptionBrand[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.brands);
  return db.brand.findMany({ where: { isOwn: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true } });
}

export async function getConcernOptions(): Promise<OptionConcern[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.concerns);
  return db.concern.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } });
}

/** Sponsored-product placements sellers can book (S3 search results, P1 related on product pages). */
export async function getSellerSlots(): Promise<OptionSlot[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.ads);
  return db.adSlot.findMany({
    where: { code: { in: ["S3", "P1"] } },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, page: true, pricingModel: true, rate: true, isActive: true, description: true },
  });
}

export type SellLandingStats = { brands: number; categories: number; products: number; sellers: number; cpcFrom: number | null; brandNames: string[] };

/** Numbers for the public /sell landing page. */
export async function getSellLandingStats(): Promise<SellLandingStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.brands, TAGS.products, TAGS.sellers, TAGS.ads);
  const [brands, categories, products, sellers, slots, brandRows] = await Promise.all([
    db.brand.count(),
    db.category.count({ where: { isActive: true } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.seller.count({ where: { status: "APPROVED" } }),
    db.adSlot.findMany({ where: { code: { in: ["S3", "P1"] } }, select: { rate: true } }),
    db.brand.findMany({ where: { isOwn: false }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }], take: 10, select: { name: true } }),
  ]);
  const rates = slots.map((s) => s.rate).filter((r) => r > 0);
  return { brands, categories, products, sellers, cpcFrom: rates.length ? Math.min(...rates) : null, brandNames: brandRows.map((b) => b.name) };
}
