import type { MetadataRoute } from "next";
import { getCatalog } from "@/server/catalog/data";
import { listProductSlugs } from "@/server/catalog/product";
import { env } from "@/lib/env";

/** /sitemap.xml — home, landing pages, categories, brand stores and every ACTIVE product (cached reads). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl.replace(/\/$/, "");
  const [snap, products] = await Promise.all([getCatalog(), listProductSlugs()]);
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/deals`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/gifts`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/brands`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/credits`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/advertise`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/sell`, changeFrequency: "monthly", priority: 0.4 },
  ];
  return [
    ...fixed,
    ...snap.categories.map((c) => ({ url: `${base}/c/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...snap.brands.filter((b) => b.productCount > 0).map((b) => ({ url: `${base}/brand/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
