import "server-only";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { productCardSelect, toProductCard } from "@/server/catalog/cards";
import type { ProductCardData } from "@/types/shared";

/** WISHLIST — signed-in users only (guests get a "sign in" prompt in the UI). */

export async function getWishlistIds(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({ where: { userId }, select: { productId: true }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => r.productId);
}

export async function getWishlist(userId: string): Promise<{ ids: string[]; items: ProductCardData[] }> {
  const rows = await db.wishlistItem.findMany({
    where: { userId, product: { status: { in: ["ACTIVE", "ARCHIVED"] } } },
    orderBy: { createdAt: "desc" },
    select: { product: { select: productCardSelect } },
  });
  const items = rows.map((r) => toProductCard(r.product));
  return { ids: await getWishlistIds(userId), items };
}

export async function addToWishlist(userId: string, productId: string): Promise<string[]> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { status: true } });
  if (!product || product.status !== "ACTIVE") throw err.notFound("Product not found");
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  return getWishlistIds(userId);
}

export async function removeFromWishlist(userId: string, productId: string): Promise<string[]> {
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
  return getWishlistIds(userId);
}
