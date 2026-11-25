import "server-only";
import { z } from "zod";
import { db, type Prisma, type ProductStatus } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { slugify } from "@/lib/ids";
import { brandLiteSelect } from "@/server/catalog/cards";

export const LOW_STOCK = 10;
const STATUSES = ["DRAFT", "PENDING", "ACTIVE", "REJECTED", "ARCHIVED"] as const;
export const SHAPES = ["bottle", "tube", "dropper", "jar", "pump", "stick"] as const;

// ───────────── list ─────────────

export const ProductListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(40).optional(),
  category: z.string().trim().max(40).optional(),
  seller: z.string().trim().max(40).optional(), // "tbb" = The Big Brands Retail
  status: z.enum(STATUSES).optional(),
  stock: z.enum(["in", "low", "out"]).optional(),
  sort: z.enum(["updated", "name", "price", "stock", "sold", "created"]).default("updated"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ProductListQuery = z.infer<typeof ProductListQuery>;

export async function listProducts(q: ProductListQuery) {
  const and: Prisma.ProductWhereInput[] = [];
  if (q.q) {
    const ci = { contains: q.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: ci }, { sku: ci }, { slug: ci }, { tags: { has: q.q.toLowerCase() } }, { brand: { name: ci } }] });
  }
  if (q.brand) and.push({ OR: [{ brandId: q.brand }, { brand: { slug: q.brand } }] });
  if (q.category) and.push({ OR: [{ categoryId: q.category }, { category: { slug: q.category } }] });
  if (q.seller === "tbb") and.push({ sellerId: null });
  else if (q.seller) and.push({ sellerId: q.seller });
  if (q.status) and.push({ status: q.status });
  else and.push({ status: { not: "ARCHIVED" } });
  if (q.stock === "out") and.push({ stock: { lte: 0 } });
  if (q.stock === "low") and.push({ stock: { gt: 0, lte: LOW_STOCK } });
  if (q.stock === "in") and.push({ stock: { gt: LOW_STOCK } });
  const where: Prisma.ProductWhereInput = { AND: and };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === "name" ? { name: q.dir } : q.sort === "price" ? { price: q.dir } : q.sort === "stock" ? { stock: q.dir } : q.sort === "sold" ? { soldCount: q.dir } : q.sort === "created" ? { createdAt: q.dir } : { updatedAt: q.dir };

  const now = new Date();
  const [total, rows, liveCamps] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        slug: true,
        name: true,
        sku: true,
        size: true,
        mrp: true,
        price: true,
        stock: true,
        status: true,
        soldCount: true,
        rating: true,
        reviewCount: true,
        badge: true,
        isOwnLabel: true,
        isFeatured: true,
        shape: true,
        colorPrimary: true,
        colorSecondary: true,
        updatedAt: true,
        brand: { select: brandLiteSelect },
        category: { select: { name: true, slug: true } },
        seller: { select: { id: true, displayName: true } },
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        giftItem: { select: { id: true } },
      },
    }),
    db.adCampaign.findMany({
      where: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now } },
      select: { productIds: true, targetKey: true, slot: { select: { code: true } } },
    }),
  ]);
  const placements = new Map<string, Set<string>>();
  for (const c of liveCamps) {
    for (const id of [...c.productIds, ...(c.targetKey ? [c.targetKey] : [])]) {
      if (!placements.has(id)) placements.set(id, new Set());
      placements.get(id)!.add(c.slot.code);
    }
  }
  const items = rows.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
    image: p.images[0] ?? null,
    art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary },
    placements: [...(placements.get(p.id) ?? [])].sort(),
    isGift: !!p.giftItem,
  }));
  return paged(items, total, q.page, q.limit);
}

export async function productStats() {
  const [live, pending, low, out, total] = await Promise.all([
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "ACTIVE", stock: { gt: 0, lte: LOW_STOCK } } }),
    db.product.count({ where: { status: "ACTIVE", stock: { lte: 0 } } }),
    db.product.count({ where: { status: { not: "ARCHIVED" } } }),
  ]);
  return { live, pending, low, out, total };
}

/** Options for filters and the product form. */
export async function productFormOptions() {
  const [brands, categories, sellers, concerns] = await Promise.all([
    db.brand.findMany({ orderBy: [{ isOwn: "desc" }, { name: "asc" }], select: { id: true, name: true, slug: true, isOwn: true } }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, isActive: true } }),
    db.seller.findMany({ where: { status: { in: ["APPROVED", "SUSPENDED"] } }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, status: true } }),
    db.concern.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  return { brands, categories, sellers, concerns, shapes: SHAPES };
}

// ───────────── single product ─────────────

export async function getProductForEdit(id: string) {
  const p = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      brand: { select: brandLiteSelect },
      category: { select: { name: true, slug: true } },
      seller: { select: { id: true, displayName: true, status: true } },
      giftItem: { select: { id: true, miniName: true } },
      _count: { select: { orderItems: true, reviews: true } },
    },
  });
  if (!p) return null;
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    line: ((p.meta ?? {}) as { line?: string }).line ?? "",
  };
}
export type ProductForEdit = NonNullable<Awaited<ReturnType<typeof getProductForEdit>>>;

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #f5d76e")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const ImageInput = z.object({ url: z.string().trim().min(1).max(500).refine((u) => u.startsWith("/") || /^https:\/\//.test(u), "Images must be uploaded files"), alt: z.string().trim().max(200).nullable().optional() });

const ProductFields = z.object({
  name: z.string().trim().min(3, "Name is too short").max(160),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? slugify(v) : undefined)),
  brandId: z.string().trim().min(1, "Choose a brand"),
  categoryId: z.string().trim().min(1, "Choose a category"),
  sellerId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  sku: optText(40),
  size: optText(40),
  mrp: z.coerce.number().int("Whole rupees only").min(1, "MRP is required").max(500000),
  price: z.coerce.number().int("Whole rupees only").min(1, "Price is required").max(500000),
  stock: z.coerce.number().int().min(0).max(1000000),
  status: z.enum(STATUSES),
  badge: optText(30),
  description: optText(5000),
  howToUse: optText(3000),
  ingredients: optText(4000),
  bullets: z.array(z.string().trim().min(1).max(200)).max(8),
  concerns: z.array(z.string().trim().min(1).max(40)).max(9),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30),
  shape: z.enum(SHAPES).nullable().optional().or(z.literal("").transform(() => null)),
  colorPrimary: hex,
  colorSecondary: hex,
  line: optText(30),
  isFeatured: z.boolean(),
  isOwnLabel: z.boolean(),
  images: z.array(ImageInput).max(10),
  rejectionReason: optText(300),
});

// Create: defaults for optional collections/flags. Patch: NO defaults (absent = unchanged).
export const ProductCreate = ProductFields.extend({
  status: z.enum(STATUSES).default("DRAFT"),
  bullets: ProductFields.shape.bullets.default([]),
  concerns: ProductFields.shape.concerns.default([]),
  tags: ProductFields.shape.tags.default([]),
  isFeatured: z.boolean().default(false),
  isOwnLabel: z.boolean().default(false),
  images: ProductFields.shape.images.default([]),
}).refine((v) => v.price <= v.mrp, { path: ["price"], message: "Price can't be higher than MRP" });
export const ProductPatch = ProductFields.partial().refine((v) => v.price == null || v.mrp == null || v.price <= v.mrp, { path: ["price"], message: "Price can't be higher than MRP" });

async function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "product";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const hit = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
    slug = `${root}-${i}`.slice(0, 80);
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function assertRefs(v: { brandId?: string; categoryId?: string; sellerId?: string | null; concerns?: string[]; sku?: string | null }, exceptId?: string) {
  const [brand, cat, seller, concerns, sku] = await Promise.all([
    v.brandId ? db.brand.findUnique({ where: { id: v.brandId }, select: { id: true, slug: true } }) : null,
    v.categoryId ? db.category.findUnique({ where: { id: v.categoryId }, select: { id: true } }) : null,
    v.sellerId ? db.seller.findUnique({ where: { id: v.sellerId }, select: { id: true } }) : null,
    v.concerns?.length ? db.concern.findMany({ where: { slug: { in: v.concerns } }, select: { slug: true } }) : [],
    v.sku ? db.product.findUnique({ where: { sku: v.sku }, select: { id: true } }) : null,
  ]);
  const fe: Record<string, string[]> = {};
  if (v.brandId && !brand) fe.brandId = ["Unknown brand"];
  if (v.categoryId && !cat) fe.categoryId = ["Unknown category"];
  if (v.sellerId && !seller) fe.sellerId = ["Unknown seller"];
  if (v.concerns?.length && concerns.length !== new Set(v.concerns).size) fe.concerns = ["Unknown concern"];
  if (sku && sku.id !== exceptId) fe.sku = ["Another product already uses this SKU"];
  if (Object.keys(fe).length) throw err.badRequest("Please check the highlighted fields", { fieldErrors: fe });
  return { brandSlug: brand?.slug };
}

function imageRows(images: Array<{ url: string; alt?: string | null }>, existing: Array<{ url: string; source: string | null; sourceUrl: string | null; license: string | null; attribution: string | null; width: number | null; height: number | null }>, fallbackAlt: string) {
  return images.map((img, i) => {
    const prev = existing.find((e) => e.url === img.url);
    return {
      url: img.url,
      alt: img.alt || fallbackAlt,
      sortOrder: i,
      source: prev?.source ?? "admin upload",
      sourceUrl: prev?.sourceUrl ?? null,
      license: prev?.license ?? null,
      attribution: prev?.attribution ?? null,
      width: prev?.width ?? null,
      height: prev?.height ?? null,
    };
  });
}

function invalidateProduct(p: { id: string; slug: string }, extra: string[] = []) {
  invalidate(TAGS.products, TAGS.product(p.id), TAGS.product(p.slug), ...extra);
}

export async function createProduct(input: z.infer<typeof ProductCreate>, actorId: string) {
  const { brandSlug } = await assertRefs(input);
  const slug = await uniqueSlug(input.slug || input.name);
  const { images, line, ...data } = input;
  const p = await db.product.create({
    data: {
      ...data,
      slug,
      meta: line ? { line } : undefined,
      images: { create: imageRows(images, [], input.name) },
    },
    select: { id: true, slug: true, name: true, status: true },
  });
  invalidateProduct(p, brandSlug ? [TAGS.brand(brandSlug)] : []);
  await audit(actorId, "product.create", "Product", p.id, { name: p.name, status: p.status });
  return p;
}

export async function updateProduct(id: string, input: z.infer<typeof ProductPatch>, actorId: string) {
  const cur = await db.product.findUnique({ where: { id }, include: { images: true, brand: { select: { slug: true } } } });
  if (!cur) throw err.notFound("Product not found");
  const { brandSlug } = await assertRefs(input, id);
  const merged = { mrp: input.mrp ?? cur.mrp, price: input.price ?? cur.price };
  if (merged.price > merged.mrp) throw err.badRequest("Price can't be higher than MRP", { fieldErrors: { price: ["Price can't be higher than MRP"] } });
  const { images, line, slug: slugIn, ...rest } = input;
  const data: Prisma.ProductUpdateInput = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) (data as Record<string, unknown>)[k] = v;
  if (input.sellerId !== undefined) {
    delete (data as Record<string, unknown>).sellerId;
    data.seller = input.sellerId ? { connect: { id: input.sellerId } } : { disconnect: true };
  }
  if (input.brandId) {
    delete (data as Record<string, unknown>).brandId;
    data.brand = { connect: { id: input.brandId } };
  }
  if (input.categoryId) {
    delete (data as Record<string, unknown>).categoryId;
    data.category = { connect: { id: input.categoryId } };
  }
  if (slugIn && slugIn !== cur.slug) data.slug = await uniqueSlug(slugIn, id);
  if (line !== undefined) data.meta = { ...((cur.meta ?? {}) as object), line: line ?? undefined } as Prisma.InputJsonValue;
  if (input.status && input.status !== "REJECTED") data.rejectionReason = input.rejectionReason ?? null;

  const p = await db.$transaction(async (tx) => {
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length) await tx.productImage.createMany({ data: imageRows(images, cur.images, input.name ?? cur.name).map((r) => ({ ...r, productId: id })) });
    }
    return tx.product.update({ where: { id }, data, select: { id: true, slug: true, name: true, status: true, stock: true, price: true } });
  });
  const extra = [TAGS.brand(cur.brand.slug), TAGS.product(cur.slug)];
  if (brandSlug) extra.push(TAGS.brand(brandSlug));
  invalidateProduct(p, extra);
  if (cur.isOwnLabel || input.isOwnLabel) invalidate(TAGS.gifts);
  const changed = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined);
  await audit(actorId, input.status && input.status !== cur.status ? `product.${input.status.toLowerCase()}` : "product.update", "Product", id, {
    name: p.name,
    changed,
    ...(input.price != null && input.price !== cur.price ? { price: [cur.price, input.price] } : {}),
    ...(input.stock != null && input.stock !== cur.stock ? { stock: [cur.stock, input.stock] } : {}),
    ...(input.status && input.status !== cur.status ? { status: [cur.status, input.status] } : {}),
  });
  return p;
}

/** Archive (soft delete — orders keep referencing the product). */
export async function archiveProduct(id: string, actorId: string) {
  const cur = await db.product.findUnique({ where: { id }, select: { id: true, slug: true, name: true, status: true, giftItem: { select: { id: true, isActive: true } }, brand: { select: { slug: true } } } });
  if (!cur) throw err.notFound("Product not found");
  if (cur.giftItem?.isActive) throw err.conflict("This product's mini is an active free gift — switch the gift off first");
  const p = await db.product.update({ where: { id }, data: { status: "ARCHIVED" }, select: { id: true, slug: true, status: true } });
  await db.cartItem.deleteMany({ where: { productId: id, savedForLater: false } });
  invalidateProduct(p, [TAGS.brand(cur.brand.slug)]);
  await audit(actorId, "product.archive", "Product", id, { name: cur.name, from: cur.status });
  return p;
}

// ───────────── approvals (seller-submitted products) ─────────────

export async function listApprovals() {
  const [pending, recent] = await Promise.all([
    db.product.findMany({
      where: { status: "PENDING" },
      orderBy: { updatedAt: "asc" },
      include: {
        brand: { select: brandLiteSelect },
        category: { select: { name: true } },
        seller: { select: { id: true, displayName: true, businessName: true, status: true, commissionPct: true, brandsAuthorised: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
      },
    }),
    db.auditLog.findMany({
      where: { action: { in: ["product.approve", "product.reject"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  return {
    pending: pending.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary },
      brandAuthorised: p.seller ? p.seller.brandsAuthorised.some((b) => b.toLowerCase() === p.brand.name.toLowerCase()) : true,
    })),
    recent: recent.map((r) => ({
      id: r.id,
      action: r.action,
      productId: r.entityId,
      data: (r.data ?? {}) as { name?: string; reason?: string; seller?: string },
      actor: r.actor?.name ?? "Admin",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export const ApprovalBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string({ error: "Tell the seller what to fix" }).trim().min(5, "Tell the seller what to fix (5+ characters)").max(300) }),
]);

export async function decideApproval(id: string, body: z.infer<typeof ApprovalBody>, actorId: string) {
  const p = await db.product.findUnique({ where: { id }, select: { id: true, slug: true, name: true, status: true, stock: true, brand: { select: { slug: true } }, seller: { select: { displayName: true, status: true } } } });
  if (!p) throw err.notFound("Product not found");
  if (p.status !== "PENDING") throw err.conflict(`This product is already ${p.status.toLowerCase()}`);
  const status: ProductStatus = body.action === "approve" ? "ACTIVE" : "REJECTED";
  if (status === "ACTIVE" && p.seller && p.seller.status !== "APPROVED") throw err.conflict("The seller account isn't approved — approve the seller first");
  const updated = await db.product.update({
    where: { id },
    data: { status, rejectionReason: body.action === "reject" ? body.reason : null },
    select: { id: true, slug: true, status: true },
  });
  invalidateProduct(updated, [TAGS.brand(p.brand.slug), TAGS.sellers]);
  await audit(actorId, `product.${body.action}`, "Product", id, { name: p.name, seller: p.seller?.displayName ?? null, ...(body.action === "reject" ? { reason: body.reason } : {}) });
  return updated;
}
