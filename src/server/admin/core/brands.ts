import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { slugify } from "@/lib/ids";

/** Font stacks offered for brand wordmarks (next/font variables from the root layout). */
export const BRAND_FONTS = [
  { value: "var(--font-geist), sans-serif", label: "Geist (clean sans)" },
  { value: "var(--font-bricolage), sans-serif", label: "Bricolage (bold grotesque)" },
  { value: "var(--font-dmserif), serif", label: "DM Serif (luxury serif)" },
  { value: "var(--font-instrument), serif", label: "Instrument Serif (editorial)" },
  { value: "var(--font-syne), sans-serif", label: "Syne (wide display)" },
  { value: "var(--font-bebas), sans-serif", label: "Bebas Neue (condensed caps)" },
  { value: "var(--font-caveat), cursive", label: "Caveat (handwritten)" },
] as const;

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1b4f9c");
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const url = z
  .string()
  .trim()
  .max(500)
  .refine((u) => !u || u.startsWith("/") || /^https:\/\//.test(u), "Upload an image or use an https:// URL")
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const BrandFields = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? slugify(v) : undefined)),
  word: opt(40),
  sub: opt(20),
  color: hex,
  accent: hex.nullable().optional().or(z.literal("").transform(() => null)),
  font: z.enum(BRAND_FONTS.map((f) => f.value) as [string, ...string[]]).nullable().optional(),
  fontWeight: z.coerce.number().int().refine((n) => [300, 400, 500, 600, 700, 800].includes(n), "Pick a weight"),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
  letterSpacing: z.string().trim().regex(/^-?\.?\d*\.?\d+(em)?$|^0$/, "e.g. .1em, -.02em or 0").max(10),
  italic: z.boolean(),
  tagline: opt(120),
  description: opt(2000),
  logoUrl: url,
  bannerUrl: url,
  isOwn: z.boolean(),
  featured: z.boolean(),
  storeActive: z.boolean(),
  storeActiveUntil: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid date" });
        return z.NEVER;
      }
      return d;
    }),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export const BrandCreate = BrandFields.extend({
  color: hex.default("#17121f"),
  fontWeight: BrandFields.shape.fontWeight.default(700),
  textTransform: BrandFields.shape.textTransform.default("none"),
  letterSpacing: BrandFields.shape.letterSpacing.default("0"),
  italic: z.boolean().default(false),
  isOwn: z.boolean().default(false),
  featured: z.boolean().default(false),
  storeActive: z.boolean().default(false),
  sortOrder: BrandFields.shape.sortOrder.default(0),
});
export const BrandPatch = BrandFields.partial();

export async function listBrands(q?: string) {
  const where: Prisma.BrandWhereInput = q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {};
  const [brands, active] = await Promise.all([
    db.brand.findMany({
      where,
      orderBy: [{ isOwn: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true, campaigns: true, coupons: true } } },
    }),
    db.product.groupBy({ by: ["brandId"], where: { status: "ACTIVE" }, _count: { _all: true } }),
  ]);
  const activeBy = new Map(active.map((a) => [a.brandId, a._count._all]));
  return brands.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    storeActiveUntil: b.storeActiveUntil?.toISOString() ?? null,
    productCount: b._count.products,
    activeProducts: activeBy.get(b.id) ?? 0,
    campaignCount: b._count.campaigns,
    couponCount: b._count.coupons,
  }));
}

async function uniqueBrandSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "brand";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const hit = await db.brand.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function brandTags(...slugs: string[]) {
  invalidate(TAGS.brands, TAGS.products, TAGS.ads, ...slugs.map((s) => TAGS.brand(s)));
}

export async function createBrand(input: z.infer<typeof BrandCreate>, actorId: string) {
  const slug = await uniqueBrandSlug(input.slug || input.name);
  const b = await db.brand.create({ data: { ...input, slug } });
  brandTags(b.slug);
  await audit(actorId, "brand.create", "Brand", b.id, { name: b.name });
  return b;
}

export async function updateBrand(id: string, input: z.infer<typeof BrandPatch>, actorId: string) {
  const cur = await db.brand.findUnique({ where: { id } });
  if (!cur) throw err.notFound("Brand not found");
  const data: Prisma.BrandUpdateInput = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined && k !== "slug") (data as Record<string, unknown>)[k] = v;
  if (input.slug && input.slug !== cur.slug) data.slug = await uniqueBrandSlug(input.slug, id);
  if (input.storeActive === false) data.storeActiveUntil = input.storeActiveUntil ?? null;
  const b = await db.brand.update({ where: { id }, data });
  brandTags(cur.slug, b.slug);
  const changed = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined);
  const action = changed.length === 1 && changed[0] === "storeActive" ? (input.storeActive ? "brand.store_on" : "brand.store_off") : "brand.update";
  await audit(actorId, action, "Brand", id, { name: b.name, changed });
  return b;
}

export async function deleteBrand(id: string, actorId: string) {
  const b = await db.brand.findUnique({ where: { id }, include: { _count: { select: { products: true, campaigns: true, coupons: true, advertisers: true, sponsoredConcerns: true } } } });
  if (!b) throw err.notFound("Brand not found");
  const c = b._count;
  if (c.products || c.campaigns || c.coupons || c.advertisers || c.sponsoredConcerns) {
    throw err.conflict(`${b.name} is in use (${c.products} products, ${c.campaigns} campaigns, ${c.coupons} coupons) — remove those first or turn its store off instead`);
  }
  await db.brand.delete({ where: { id } });
  brandTags(b.slug);
  await audit(actorId, "brand.delete", "Brand", id, { name: b.name });
  return { id, deleted: true };
}

// ───────────── categories ─────────────

const CategoryFields = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? slugify(v) : undefined)),
  short: opt(30),
  description: opt(500),
  imageUrl: url,
  parentId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});
export const CategoryCreate = CategoryFields.extend({ sortOrder: CategoryFields.shape.sortOrder.default(0), isActive: z.boolean().default(true) });
export const CategoryPatch = CategoryFields.partial();

export async function listCategories() {
  const cats = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { parent: { select: { name: true } }, _count: { select: { products: true, children: true } } },
  });
  const active = await db.product.groupBy({ by: ["categoryId"], where: { status: "ACTIVE" }, _count: { _all: true } });
  const by = new Map(active.map((a) => [a.categoryId, a._count._all]));
  return cats.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), productCount: c._count.products, activeProducts: by.get(c.id) ?? 0, childCount: c._count.children }));
}

async function uniqueCatSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "category";
  let slug = root;
  for (let i = 2; i < 100; i++) {
    const hit = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function catTags() {
  invalidate(TAGS.categories, TAGS.products);
}

export async function createCategory(input: z.infer<typeof CategoryCreate>, actorId: string) {
  if (input.parentId && !(await db.category.findUnique({ where: { id: input.parentId }, select: { id: true } }))) throw err.badRequest("Unknown parent category");
  const slug = await uniqueCatSlug(input.slug || input.name);
  const c = await db.category.create({ data: { ...input, slug } });
  catTags();
  await audit(actorId, "category.create", "Category", c.id, { name: c.name });
  return c;
}

export async function updateCategory(id: string, input: z.infer<typeof CategoryPatch>, actorId: string) {
  const cur = await db.category.findUnique({ where: { id } });
  if (!cur) throw err.notFound("Category not found");
  if (input.parentId === id) throw err.badRequest("A category can't be its own parent", { fieldErrors: { parentId: ["Choose another parent"] } });
  const data: Prisma.CategoryUncheckedUpdateInput = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined && k !== "slug") (data as Record<string, unknown>)[k] = v;
  if (input.slug && input.slug !== cur.slug) data.slug = await uniqueCatSlug(input.slug, id);
  const c = await db.category.update({ where: { id }, data });
  catTags();
  await audit(actorId, input.isActive === false ? "category.hide" : "category.update", "Category", id, { name: c.name, changed: Object.keys(input) });
  return c;
}

export async function deleteCategory(id: string, actorId: string) {
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } });
  if (!c) throw err.notFound("Category not found");
  if (c._count.products || c._count.children) throw err.conflict(`${c.name} has ${c._count.products} products and ${c._count.children} sub-categories — move them first or hide the category`);
  await db.category.delete({ where: { id } });
  catTags();
  await audit(actorId, "category.delete", "Category", id, { name: c.name });
  return { id, deleted: true };
}
