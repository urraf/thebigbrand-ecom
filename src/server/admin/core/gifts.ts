import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { brandLiteSelect } from "@/server/catalog/cards";
import { istMonthStart } from "./time";
import { giftConversion } from "./dashboard";

const REV_SQL = `'PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','RETURN_REQUESTED'`;
export const LOW_GIFT_STOCK = 50;
export const MAX_GIFTS_PER_ORDER = 5;

/** Free-gift admin view: minis with stock + performance, the tier rules, and own-label products for the picker. */
export async function getGiftsAdmin() {
  const monthStart = istMonthStart();
  const [items, tiers, ownProducts, perf, monthCounts, conv] = await Promise.all([
    db.giftItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            mrp: true,
            stock: true,
            status: true,
            isOwnLabel: true,
            shape: true,
            colorPrimary: true,
            colorSecondary: true,
            meta: true,
            brand: { select: brandLiteSelect },
            images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    }),
    db.giftTier.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" } }),
    db.product.findMany({
      where: { OR: [{ isOwnLabel: true }, { brand: { isOwn: true } }], status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, size: true, price: true, giftItem: { select: { id: true } } },
    }),
    db.$queryRawUnsafe<Array<{ gid: string; given: number; customers: number; converted: number; revenue: number }>>(`
      WITH gifted AS (
        SELECT og."giftItemId" AS gid, o."userId", gi."productId", MIN(COALESCE(o."placedAt", o."createdAt")) AS first_at, COUNT(*) AS n
        FROM "OrderGift" og JOIN "Order" o ON o.id = og."orderId" JOIN "GiftItem" gi ON gi.id = og."giftItemId"
        WHERE o.status::text IN (${REV_SQL})
        GROUP BY 1, 2, 3
      ), conv AS (
        SELECT g.gid, g."userId", SUM(oi."lineTotal") AS revenue
        FROM gifted g
        JOIN "Order" o2 ON o2."userId" = g."userId" AND COALESCE(o2."placedAt", o2."createdAt") > g.first_at AND o2.status::text IN (${REV_SQL})
        JOIN "OrderItem" oi ON oi."orderId" = o2.id AND oi."productId" = g."productId" AND oi.status::text <> 'CANCELLED'
        GROUP BY 1, 2
      )
      SELECT g.gid, SUM(g.n)::int AS given, COUNT(DISTINCT g."userId")::int AS customers,
             COUNT(DISTINCT c."userId")::int AS converted, COALESCE(SUM(c.revenue), 0)::int AS revenue
      FROM gifted g LEFT JOIN conv c ON c.gid = g.gid AND c."userId" = g."userId"
      GROUP BY g.gid
    `),
    db.orderGift.groupBy({
      by: ["giftItemId"],
      where: { order: { status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] }, createdAt: { gte: monthStart } } },
      _count: { _all: true },
    }),
    giftConversion(),
  ]);
  const perfBy = new Map(perf.map((p) => [p.gid, p]));
  const monthBy = new Map(monthCounts.map((m) => [m.giftItemId, m._count._all]));
  const monthTotal = monthCounts.reduce((t, m) => t + m._count._all, 0);
  return {
    items: items.map((g) => {
      const p = perfBy.get(g.id);
      const month = monthBy.get(g.id) ?? 0;
      return {
        id: g.id,
        productId: g.productId,
        miniName: g.miniName,
        miniSize: g.miniSize,
        worth: g.worth,
        stock: g.stock,
        isActive: g.isActive,
        sortOrder: g.sortOrder,
        product: {
          ...g.product,
          image: g.product.images[0] ? { ...g.product.images[0], width: null, height: null } : null,
          art: { shape: g.product.shape, c1: g.product.colorPrimary, c2: g.product.colorSecondary, line: ((g.product.meta ?? {}) as { line?: string }).line ?? null },
        },
        givenMonth: month,
        pickShare: monthTotal ? month / monthTotal : 0,
        givenAll: Number(p?.given ?? 0),
        customers: Number(p?.customers ?? 0),
        converted: Number(p?.converted ?? 0),
        conversion: p && Number(p.customers) ? Number(p.converted) / Number(p.customers) : 0,
        fullSizeRevenue: Number(p?.revenue ?? 0),
      };
    }),
    tiers: tiers.map((t) => ({ id: t.id, minAmount: t.minAmount, giftCount: t.giftCount })),
    ownProducts: ownProducts.map((p) => ({ id: p.id, name: p.name, size: p.size, price: p.price, taken: !!p.giftItem, giftItemId: p.giftItem?.id ?? null })),
    funnel: {
      givenMonth: monthTotal,
      customers: conv.gifted, // distinct customers who received at least one mini
      converted: conv.converted, // …and later bought that mini's full-size product
      revenue: perf.reduce((t, p) => t + Number(p.revenue), 0),
      rate: conv.rate,
    },
  };
}

const GiftFields = z.object({
  productId: z.string().trim().min(1, "Choose the TBB Original this mini comes from"),
  miniName: z.string().trim().min(3).max(80),
  miniSize: z.string().trim().min(2).max(30),
  worth: z.coerce.number().int().min(1).max(5000),
  stock: z.coerce.number().int().min(0).max(1000000),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});
export const GiftCreate = GiftFields.extend({ isActive: z.boolean().default(true), sortOrder: GiftFields.shape.sortOrder.default(0), stock: GiftFields.shape.stock.default(0) });
export const GiftPatch = GiftFields.omit({ productId: true })
  .partial()
  .extend({ addStock: z.coerce.number().int().min(1).max(100000).optional() });

async function activeGiftCount(exceptId?: string) {
  return db.giftItem.count({ where: { isActive: true, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}
async function maxTierCount() {
  const t = await db.giftTier.findFirst({ where: { isActive: true }, orderBy: { giftCount: "desc" }, select: { giftCount: true } });
  return t?.giftCount ?? 0;
}

export async function createGift(input: z.infer<typeof GiftCreate>, actorId: string) {
  const p = await db.product.findUnique({ where: { id: input.productId }, select: { id: true, name: true, isOwnLabel: true, brand: { select: { isOwn: true } }, giftItem: { select: { id: true } } } });
  if (!p) throw err.badRequest("Unknown product", { fieldErrors: { productId: ["Unknown product"] } });
  if (!p.isOwnLabel && !p.brand.isOwn) throw err.badRequest("Free gifts must be minis of TBB Originals products", { fieldErrors: { productId: ["Pick a TBB Originals product"] } });
  if (p.giftItem) throw err.conflict("This product already has a free-gift mini — edit that one instead", { fieldErrors: { productId: ["Already a gift"] } });
  const g = await db.giftItem.create({ data: input });
  invalidate(TAGS.gifts);
  await audit(actorId, "gift.create", "GiftItem", g.id, { miniName: g.miniName, stock: g.stock });
  return g;
}

export async function updateGift(id: string, input: z.infer<typeof GiftPatch>, actorId: string) {
  const cur = await db.giftItem.findUnique({ where: { id } });
  if (!cur) throw err.notFound("Gift not found");
  if (input.isActive === false && cur.isActive) {
    const others = await activeGiftCount(id);
    if (others === 0) throw err.conflict("Keep at least one gift on — every order includes a free gift");
    const need = await maxTierCount();
    if (others < need) throw err.conflict(`Your top tier gives ${need} gifts but only ${others} would be left — lower the tier first`);
  }
  const { addStock, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) data[k] = v;
  if (addStock) data.stock = { increment: addStock };
  const g = await db.giftItem.update({ where: { id }, data });
  invalidate(TAGS.gifts);
  const action = addStock ? "gift.restock" : input.isActive !== undefined && Object.keys(data).length === 1 ? (input.isActive ? "gift.show" : "gift.hide") : "gift.update";
  await audit(actorId, action, "GiftItem", id, { miniName: g.miniName, ...(addStock ? { added: addStock, stock: g.stock } : { changed: Object.keys(data) }) });
  return g;
}

export async function deleteGift(id: string, actorId: string) {
  const g = await db.giftItem.findUnique({ where: { id }, include: { _count: { select: { orderGifts: true } } } });
  if (!g) throw err.notFound("Gift not found");
  if (g._count.orderGifts) throw err.conflict(`${g.miniName} is part of ${g._count.orderGifts} past orders — switch it off instead of deleting`);
  if (g.isActive && (await activeGiftCount(id)) === 0) throw err.conflict("Keep at least one gift on — every order includes a free gift");
  await db.giftItem.delete({ where: { id } });
  invalidate(TAGS.gifts);
  await audit(actorId, "gift.delete", "GiftItem", id, { miniName: g.miniName });
  return { id, deleted: true };
}

// ───────────── tier rules ─────────────

export const TiersBody = z
  .object({
    tiers: z
      .array(z.object({ minAmount: z.coerce.number().int().min(0).max(1000000), giftCount: z.coerce.number().int().min(1).max(MAX_GIFTS_PER_ORDER) }))
      .min(1, "Add at least one tier")
      .max(6, "Up to 6 tiers"),
  })
  .superRefine((v, ctx) => {
    const t = [...v.tiers].sort((a, b) => a.minAmount - b.minAmount);
    if (t[0].minAmount !== 0) ctx.addIssue({ code: "custom", path: ["tiers"], message: "The first tier must start at ₹0 so every order gets a gift" });
    for (let i = 1; i < t.length; i++) {
      if (t[i].minAmount === t[i - 1].minAmount) ctx.addIssue({ code: "custom", path: ["tiers"], message: "Two tiers start at the same cart value — make each one different" });
      if (t[i].giftCount <= t[i - 1].giftCount) ctx.addIssue({ code: "custom", path: ["tiers"], message: "A higher cart value must unlock more gifts than the tier before it" });
    }
  });

export async function replaceTiers(input: z.infer<typeof TiersBody>, actorId: string) {
  const tiers = [...input.tiers].sort((a, b) => a.minAmount - b.minAmount);
  const active = await activeGiftCount();
  const top = tiers[tiers.length - 1].giftCount;
  if (top > active) throw err.unprocessable(`The top tier gives ${top} gifts but only ${active} gift${active === 1 ? " is" : "s are"} switched on — add or switch on more gifts first`);
  const before = await db.giftTier.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" }, select: { minAmount: true, giftCount: true } });
  await db.$transaction([db.giftTier.deleteMany({}), db.giftTier.createMany({ data: tiers.map((t) => ({ minAmount: t.minAmount, giftCount: t.giftCount, isActive: true })) })]);
  invalidate(TAGS.gifts);
  await audit(actorId, "gift.tiers", "GiftTier", null, { before, after: tiers });
  return { tiers };
}
