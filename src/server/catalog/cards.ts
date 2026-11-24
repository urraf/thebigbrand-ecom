import "server-only";
import type { Prisma } from "@/lib/db";
import type { BrandLite, ProductCardData } from "@/types/shared";

/**
 * Shared product → card mapping (used by catalog, ads, cart, checkout, admin previews).
 * Query with `select: productCardSelect`, then map rows with `toProductCard(row)`.
 */
export const brandLiteSelect = {
  id: true,
  slug: true,
  name: true,
  word: true,
  sub: true,
  color: true,
  accent: true,
  font: true,
  fontWeight: true,
  textTransform: true,
  letterSpacing: true,
  italic: true,
  isOwn: true,
  logoUrl: true,
} satisfies Prisma.BrandSelect;

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  size: true,
  mrp: true,
  price: true,
  rating: true,
  reviewCount: true,
  soldCount: true,
  badge: true,
  stock: true,
  isOwnLabel: true,
  shape: true,
  colorPrimary: true,
  colorSecondary: true,
  meta: true,
  category: { select: { slug: true } },
  brand: { select: brandLiteSelect },
  images: { select: { url: true, alt: true, width: true, height: true }, orderBy: { sortOrder: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function toBrandLite(b: Prisma.BrandGetPayload<{ select: typeof brandLiteSelect }>): BrandLite {
  return { ...b };
}

export function toProductCard(p: ProductCardRow): ProductCardData {
  const meta = (p.meta ?? {}) as { line?: string };
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    size: p.size,
    mrp: p.mrp,
    price: p.price,
    rating: p.rating,
    reviewCount: p.reviewCount,
    soldCount: p.soldCount,
    badge: p.badge,
    stock: p.stock,
    isOwnLabel: p.isOwnLabel,
    categorySlug: p.category.slug,
    brand: toBrandLite(p.brand),
    image: p.images[0] ?? null,
    art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary, line: meta.line ?? null },
  };
}
