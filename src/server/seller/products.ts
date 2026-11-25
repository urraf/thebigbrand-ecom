import "server-only";
import { db, type Prisma, type ProductStatus, type Seller } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { slugify } from "@/lib/ids";
import type { ProductInput } from "./schemas";
import { getBrandOptions, getCategoryOptions, getConcernOptions } from "./options";

/**
 * SELLER CATALOGUE. Every query is scoped to the seller. Sellers never set ACTIVE themselves:
 * new products and content edits go to PENDING (admin approves in /admin/approvals). Price / stock-only
 * changes on a live product apply immediately (Inventory), so day-to-day operations don't need review.
 */

export const PRODUCT_TABS = ["all", "ACTIVE", "PENDING", "REJECTED", "DRAFT", "ARCHIVED"] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

export type SellerProductRow = {
  id: string;
  slug: string;
  name: string;
  size: string | null;
  sku: string | null;
  status: ProductStatus;
  rejectionReason: string | null;
  mrp: number;
  price: number;
  stock: number;
  unitsSold: number;
  /** true when the product appears in any order (then it can only be archived, never deleted) */
  hasOrders: boolean;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  image: { url: string; alt: string | null } | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
  updatedAt: string;
};

const rowSelect = {
  id: true,
  slug: true,
  name: true,
  size: true,
  sku: true,
  status: true,
  rejectionReason: true,
  mrp: true,
  price: true,
  stock: true,
  shape: true,
  colorPrimary: true,
  colorSecondary: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductSelect;

type RowPayload = Prisma.ProductGetPayload<{ select: typeof rowSelect }>;

function toRow(p: RowPayload, sold: Map<string, number>): SellerProductRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    size: p.size,
    sku: p.sku,
    status: p.status,
    rejectionReason: p.rejectionReason,
    mrp: p.mrp,
    price: p.price,
    stock: p.stock,
    unitsSold: sold.get(p.id) ?? 0,
    hasOrders: p._count.orderItems > 0,
    brand: p.brand,
    category: p.category,
    image: p.images[0] ?? null,
    art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary },
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function unitsSoldMap(sellerId: string, productIds: string[]) {
  if (!productIds.length) return new Map<string, number>();
  const rows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { sellerId, productId: { in: productIds }, status: { notIn: ["CANCELLED", "RETURNED"] }, order: { status: { not: "PENDING_PAYMENT" } } },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.qty ?? 0]));
}

export async function listSellerProducts(
  sellerId: string,
  opts: { tab?: ProductTab; q?: string; page?: number; limit?: number; lowStock?: boolean } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const q = opts.q?.trim();
  const where: Prisma.ProductWhereInput = {
    sellerId,
    ...(opts.tab && opts.tab !== "all" ? { status: opts.tab } : {}),
    ...(opts.lowStock ? { stock: { lte: 10 }, status: "ACTIVE" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.product.findMany({ where, select: rowSelect, orderBy: opts.lowStock ? [{ stock: "asc" }] : [{ updatedAt: "desc" }], skip: (page - 1) * limit, take: limit }),
    db.product.count({ where }),
    db.product.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true } }),
  ]);
  const sold = await unitsSoldMap(sellerId, rows.map((r) => r.id));
  const tabCounts: Record<string, number> = { all: 0 };
  for (const c of counts) {
    tabCounts[c.status] = c._count._all;
    tabCounts.all += c._count._all;
  }
  return { items: rows.map((r) => toRow(r, sold)), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts: tabCounts };
}

export type SellerProductDetail = SellerProductRow & {
  brandId: string;
  categoryId: string;
  description: string | null;
  howToUse: string | null;
  ingredients: string | null;
  bullets: string[];
  concerns: string[];
  tags: string[];
  images: { url: string; alt: string | null }[];
};

export async function getSellerProduct(sellerId: string, id: string): Promise<SellerProductDetail | null> {
  const p = await db.product.findFirst({
    where: { id, sellerId },
    select: {
      ...rowSelect,
      brandId: true,
      categoryId: true,
      description: true,
      howToUse: true,
      ingredients: true,
      bullets: true,
      concerns: true,
      tags: true,
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return null;
  const sold = await unitsSoldMap(sellerId, [p.id]);
  return {
    ...toRow({ ...p, images: p.images.slice(0, 1) }, sold),
    brandId: p.brandId,
    categoryId: p.categoryId,
    description: p.description,
    howToUse: p.howToUse,
    ingredients: p.ingredients,
    bullets: p.bullets,
    concerns: p.concerns,
    tags: p.tags,
    images: p.images,
  };
}

/** Brands this seller may list (their authorised brands; all third-party brands if none recorded). */
export async function allowedBrandsFor(seller: Pick<Seller, "brandsAuthorised">) {
  const all = await getBrandOptions();
  const auth = new Set(seller.brandsAuthorised.map((b) => b.trim().toLowerCase()));
  if (!auth.size) return all;
  return all.filter((b) => auth.has(b.name.toLowerCase()));
}

async function uniqueProductSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Images must be files this user uploaded (Media) or already attached to this product. */
async function checkImages(userId: string, images: ProductInput["images"], productId?: string) {
  if (!images.length) return;
  const urls = images.map((i) => i.url);
  const [mine, existing] = await Promise.all([
    db.media.findMany({ where: { uploadedById: userId, url: { in: urls } }, select: { url: true } }),
    productId ? db.productImage.findMany({ where: { productId, url: { in: urls } }, select: { url: true } }) : Promise.resolve([]),
  ]);
  const ok = new Set([...mine, ...existing].map((m) => m.url));
  const bad = urls.find((u) => !ok.has(u));
  if (bad) throw err.badRequest("Upload product photos with the uploader", { fieldErrors: { images: ["One of the photos wasn't uploaded from your account"] } });
}

async function validateRefs(seller: Seller, input: ProductInput) {
  const [brands, cats, concerns] = await Promise.all([allowedBrandsFor(seller), getCategoryOptions(), getConcernOptions()]);
  const brand = brands.find((b) => b.id === input.brandId);
  if (!brand) throw err.badRequest("You're not authorised to sell this brand", { fieldErrors: { brandId: ["Not one of your authorised brands"] } });
  if (!cats.some((c) => c.id === input.categoryId)) throw err.badRequest("Choose a category", { fieldErrors: { categoryId: ["Unknown category"] } });
  const concernSlugs = new Set(concerns.map((c) => c.slug));
  return { brand, concerns: [...new Set(input.concerns)].filter((c) => concernSlugs.has(c)) };
}

async function assertSkuFree(sku: string | null, exceptId?: string) {
  if (!sku) return;
  const hit = await db.product.findUnique({ where: { sku }, select: { id: true } });
  if (hit && hit.id !== exceptId) throw err.conflict("Another product already uses this SKU", { fieldErrors: { sku: ["SKU already in use"] } });
}

function contentData(input: ProductInput, concerns: string[]) {
  return {
    name: input.name,
    brandId: input.brandId,
    categoryId: input.categoryId,
    size: input.size,
    sku: input.sku,
    mrp: input.mrp,
    price: input.price,
    stock: input.stock,
    description: input.description,
    howToUse: input.howToUse,
    ingredients: input.ingredients,
    bullets: input.bullets,
    concerns,
    tags: [...new Set(input.tags)],
    shape: input.shape,
    colorPrimary: input.colorPrimary,
    colorSecondary: input.colorSecondary,
  };
}

function imageRows(input: ProductInput, brandName: string) {
  return input.images.map((img, i) => ({
    url: img.url,
    alt: img.alt ?? `${brandName} ${input.name}`,
    sortOrder: i,
    source: "Seller upload",
  }));
}

export async function createSellerProduct(seller: Seller, userId: string, input: ProductInput) {
  const { brand, concerns } = await validateRefs(seller, input);
  await assertSkuFree(input.sku);
  await checkImages(userId, input.images);
  const slug = await uniqueProductSlug(`${brand.name} ${input.name}`);
  const status: ProductStatus = input.submit ? "PENDING" : "DRAFT";
  const product = await db.product.create({
    data: {
      ...contentData(input, concerns),
      slug,
      sellerId: seller.id,
      status,
      shape: input.shape ?? "bottle",
      images: { create: imageRows(input, brand.name) },
    },
    select: { id: true, slug: true, status: true },
  });
  await audit(userId, input.submit ? "product.submit" : "product.draft", "Product", product.id, { seller: seller.slug, name: input.name });
  invalidate(TAGS.products, TAGS.product(product.id), TAGS.product(product.slug));
  return product;
}

const CONTENT_KEYS = ["name", "brandId", "categoryId", "size", "sku", "mrp", "description", "howToUse", "ingredients", "shape", "colorPrimary", "colorSecondary"] as const;

export async function updateSellerProduct(seller: Seller, userId: string, id: string, input: ProductInput) {
  const current = await db.product.findFirst({
    where: { id, sellerId: seller.id },
    include: { images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } } },
  });
  if (!current) throw err.notFound("Product not found");
  if (current.status === "ARCHIVED") throw err.conflict("Restore this product before editing it");
  const { brand, concerns } = await validateRefs(seller, input);
  await assertSkuFree(input.sku, id);
  await checkImages(userId, input.images, id);

  const next = contentData(input, concerns);
  const listsChanged =
    JSON.stringify(current.bullets) !== JSON.stringify(next.bullets) ||
    JSON.stringify([...current.concerns].sort()) !== JSON.stringify([...next.concerns].sort()) ||
    JSON.stringify([...current.tags].sort()) !== JSON.stringify([...next.tags].sort()) ||
    JSON.stringify(current.images.map((i) => i.url)) !== JSON.stringify(input.images.map((i) => i.url));
  const contentChanged = listsChanged || CONTENT_KEYS.some((k) => (current[k] ?? null) !== (next[k] ?? null));

  let status: ProductStatus;
  if (!input.submit) status = current.status === "ACTIVE" && !contentChanged ? "ACTIVE" : "DRAFT";
  else if (current.status === "ACTIVE" && !contentChanged) status = "ACTIVE"; // price/stock only → stays live
  else status = "PENDING";

  const slug = current.name !== input.name || current.brandId !== input.brandId ? await uniqueProductSlug(`${brand.name} ${input.name}`, id) : current.slug;

  const product = await db.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        ...next,
        slug,
        status,
        rejectionReason: status === "PENDING" ? null : current.rejectionReason,
        images: { create: imageRows(input, brand.name) },
      },
      select: { id: true, slug: true, status: true },
    });
  });
  await audit(userId, status === "PENDING" ? "product.resubmit" : "product.update", "Product", id, {
    seller: seller.slug,
    from: current.status,
    to: status,
    contentChanged,
  });
  invalidate(TAGS.products, TAGS.product(id), TAGS.product(current.slug), TAGS.product(slug));
  return { ...product, reviewRequired: status === "PENDING" && current.status === "ACTIVE" };
}

export async function setSellerProductState(seller: Seller, userId: string, id: string, action: "archive" | "restore" | "submit") {
  const current = await db.product.findFirst({ where: { id, sellerId: seller.id }, select: { id: true, slug: true, status: true } });
  if (!current) throw err.notFound("Product not found");
  let to: ProductStatus;
  if (action === "archive") {
    if (current.status === "ARCHIVED") return current;
    to = "ARCHIVED";
  } else if (action === "restore") {
    if (current.status !== "ARCHIVED") throw err.conflict("Only archived products can be restored");
    to = "PENDING";
  } else {
    if (!["DRAFT", "REJECTED"].includes(current.status)) throw err.conflict("Only drafts or rejected products can be submitted");
    to = "PENDING";
  }
  const product = await db.product.update({
    where: { id },
    data: { status: to, ...(to === "PENDING" ? { rejectionReason: null } : {}) },
    select: { id: true, slug: true, status: true },
  });
  await audit(userId, `product.${action}`, "Product", id, { seller: seller.slug, from: current.status, to });
  invalidate(TAGS.products, TAGS.product(id), TAGS.product(current.slug));
  return product;
}

export async function deleteSellerProduct(seller: Seller, userId: string, id: string) {
  const current = await db.product.findFirst({
    where: { id, sellerId: seller.id },
    select: { id: true, slug: true, status: true, name: true, _count: { select: { orderItems: true } } },
  });
  if (!current) throw err.notFound("Product not found");
  if (current.status === "ACTIVE") throw err.conflict("Live products can't be deleted — archive it instead");
  if (current._count.orderItems > 0) throw err.conflict("This product has orders — archive it instead");
  await db.product.delete({ where: { id } });
  await audit(userId, "product.delete", "Product", id, { seller: seller.slug, name: current.name });
  invalidate(TAGS.products, TAGS.product(id), TAGS.product(current.slug));
  return { id, deleted: true };
}

/** Bulk stock / price edit. Price must stay ≤ MRP; status is unchanged (no re-review for operational edits). */
export async function bulkUpdateInventory(seller: Seller, userId: string, items: { id: string; stock?: number; price?: number }[]) {
  const ids = [...new Set(items.map((i) => i.id))];
  const owned = await db.product.findMany({ where: { id: { in: ids }, sellerId: seller.id }, select: { id: true, slug: true, mrp: true, price: true, stock: true, name: true } });
  const byId = new Map(owned.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw err.forbidden("Some products don't belong to your store");
  const errors: Record<string, string[]> = {};
  for (const it of items) {
    const p = byId.get(it.id)!;
    if (it.price !== undefined && it.price > p.mrp) errors[it.id] = [`${p.name}: price can't exceed MRP ₹${p.mrp}`];
  }
  if (Object.keys(errors).length) throw err.badRequest(Object.values(errors)[0][0], { fieldErrors: errors });

  const changes = items
    .map((it) => {
      const p = byId.get(it.id)!;
      const data: { stock?: number; price?: number } = {};
      if (it.stock !== undefined && it.stock !== p.stock) data.stock = it.stock;
      if (it.price !== undefined && it.price !== p.price) data.price = it.price;
      return { id: it.id, data, before: { stock: p.stock, price: p.price } };
    })
    .filter((c) => Object.keys(c.data).length);
  if (!changes.length) return { updated: 0 };
  await db.$transaction(changes.map((c) => db.product.update({ where: { id: c.id }, data: c.data })));
  await audit(userId, "product.inventory", "Seller", seller.id, {
    changes: changes.map((c) => ({ id: c.id, before: c.before, after: c.data })),
  } as Prisma.InputJsonValue);
  invalidate(TAGS.products, ...changes.flatMap((c) => [TAGS.product(c.id), TAGS.product(byId.get(c.id)!.slug)]));
  return { updated: changes.length };
}
