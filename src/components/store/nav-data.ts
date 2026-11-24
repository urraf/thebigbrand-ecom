import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";

export type ChromeCategory = { slug: string; name: string; short: string };
export type ChromeData = {
  categories: ChromeCategory[];
  concerns: { slug: string; name: string; emoji: string | null }[];
  brands: { slug: string; name: string }[];
};

/**
 * Catalogue data the store chrome needs (search category select, sub-nav, All-categories drawer).
 * Same for everyone → cached into the static shell; admin edits invalidate the tags (expire immediately).
 * Long lifetime on purpose: the shell renders this outside <Suspense>, and a *stale* entry there makes the dev
 * server report "uncached data during prerendering" — tag invalidation, not time, keeps it fresh.
 */
export async function getChromeData(): Promise<ChromeData> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.categories, TAGS.concerns, TAGS.brands);
  const [categories, concerns, brands] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, short: true },
    }),
    db.concern.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } }),
    db.brand.findMany({
      where: { isOwn: false },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: 8,
      select: { slug: true, name: true },
    }),
  ]);
  return {
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, short: c.short || c.name })),
    concerns,
    brands,
  };
}
