import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { TAGS } from "@/lib/cache";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { ProductCardData } from "@/types/shared";

/** Bestsellers for the empty cart / empty checkout ("Bestsellers to start with"). Same for everyone → cached. */
export async function getStarterPicks(limit = 10): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.products);
  const rows = await db.product.findMany({
    where: { status: "ACTIVE", stock: { gt: 0 }, OR: [{ sellerId: null }, { seller: { status: "APPROVED" } }] },
    orderBy: [{ soldCount: "desc" }, { rating: "desc" }],
    take: limit,
    select: productCardSelect,
  });
  return rows.map(toProductCard);
}
