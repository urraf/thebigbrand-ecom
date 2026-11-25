import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { brandLiteSelect } from "@/server/catalog/cards";

export const CouponListQuery = z.object({
  q: z.string().trim().max(40).optional(),
  status: z.enum(["live", "scheduled", "expired", "off", "used_up"]).optional(),
  type: z.enum(["PERCENT", "FLAT", "BOGO"]).optional(),
  kind: z.enum(["sponsored", "store"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CouponListQuery = z.infer<typeof CouponListQuery>;

export type CouponState = "live" | "scheduled" | "expired" | "off" | "used_up";
export function couponState(c: { isActive: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number }, now = new Date()): CouponState {
  if (!c.isActive) return "off";
  if (c.endsAt && c.endsAt < now) return "expired";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "used_up";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "live";
}

export async function listCoupons(q: CouponListQuery) {
  const now = new Date();
  const and: Prisma.CouponWhereInput[] = [];
  if (q.q) and.push({ OR: [{ code: { contains: q.q, mode: "insensitive" } }, { title: { contains: q.q, mode: "insensitive" } }, { brand: { name: { contains: q.q, mode: "insensitive" } } }] });
  if (q.type) and.push({ type: q.type });
  if (q.kind) and.push({ isSponsored: q.kind === "sponsored" });
  if (q.status === "off") and.push({ isActive: false });
  if (q.status === "expired") and.push({ isActive: true, endsAt: { lt: now } });
  if (q.status === "scheduled") and.push({ isActive: true, startsAt: { gt: now } });
  if (q.status === "live") and.push({ isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] });
  const where: Prisma.CouponWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { brand: { select: brandLiteSelect }, _count: { select: { uses: true } } },
    }),
  ]);
  const sums = rows.length ? await db.couponUse.groupBy({ by: ["couponId"], where: { couponId: { in: rows.map((r) => r.id) } }, _sum: { discount: true } }) : [];
  const disc = new Map(sums.map((s) => [s.couponId, s._sum.discount ?? 0]));
  let items = rows.map((c) => ({
    ...c,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    state: couponState(c, now),
    discountGiven: disc.get(c.id) ?? 0,
  }));
  if (q.status === "used_up") items = items.filter((i) => i.state === "used_up");
  return paged(items, total, q.page, q.limit);
}

export async function couponStats() {
  const now = new Date();
  const [live, sponsored, uses, clips] = await Promise.all([
    db.coupon.count({ where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } }),
    db.coupon.count({ where: { isActive: true, isSponsored: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } }),
    db.couponUse.aggregate({ _count: { _all: true }, _sum: { discount: true } }),
    db.coupon.aggregate({ where: { isSponsored: true }, _sum: { clipCount: true } }),
  ]);
  return { live, sponsored, uses: uses._count._all, discount: uses._sum.discount ?? 0, clips: clips._sum.clipCount ?? 0 };
}

const optDate = z
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
  });

const CouponFields = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or numbers, no spaces"),
  title: z.string().trim().min(2).max(40),
  description: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  type: z.enum(["PERCENT", "FLAT", "BOGO"]),
  value: z.coerce.number().int().min(0).max(100000),
  minOrder: z.coerce.number().int().min(0).max(100000),
  maxDiscount: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  brandId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  startsAt: optDate,
  endsAt: optDate,
  usageLimit: z.coerce.number().int().min(1).max(10000000).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean(),
  isSponsored: z.boolean(),
});

type CouponShape = Partial<z.infer<typeof CouponFields>>;
function checkRules(v: CouponShape, ctx: z.RefinementCtx) {
  {
    if (v.type === "PERCENT" && v.value != null && (v.value < 1 || v.value > 90)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percent off must be 1–90" });
    if (v.type === "FLAT" && v.value != null && v.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the rupees off" });
    if (v.type === "FLAT" && v.value != null && v.minOrder != null && v.minOrder > 0 && v.value >= v.minOrder) ctx.addIssue({ code: "custom", path: ["value"], message: "Flat discount must be less than the minimum order" });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after the start" });
    if (v.isSponsored && v.brandId === null) ctx.addIssue({ code: "custom", path: ["brandId"], message: "Sponsored coupons belong to a brand" });
  }
}

export const CouponCreate = CouponFields.extend({
  value: CouponFields.shape.value.default(0),
  minOrder: CouponFields.shape.minOrder.default(0),
  perUserLimit: CouponFields.shape.perUserLimit.default(1),
  isActive: z.boolean().default(true),
  isSponsored: z.boolean().default(false),
}).superRefine(checkRules);
export const CouponPatch = CouponFields.partial().superRefine(checkRules);

async function assertCoupon(v: { code?: string; brandId?: string | null; isSponsored?: boolean }, exceptId?: string) {
  if (v.code) {
    const hit = await db.coupon.findUnique({ where: { code: v.code }, select: { id: true } });
    if (hit && hit.id !== exceptId) throw err.conflict("Another coupon already uses this code", { fieldErrors: { code: ["Code already exists"] } });
  }
  if (v.brandId && !(await db.brand.findUnique({ where: { id: v.brandId }, select: { id: true } }))) throw err.badRequest("Unknown brand", { fieldErrors: { brandId: ["Unknown brand"] } });
}

function couponTags() {
  invalidate(TAGS.coupons, TAGS.ads, TAGS.adSlot("H9"));
}

export async function createCoupon(input: z.infer<typeof CouponCreate>, actorId: string) {
  await assertCoupon(input);
  const c = await db.coupon.create({ data: { ...input, maxDiscount: input.type === "PERCENT" ? (input.maxDiscount ?? null) : null, value: input.type === "BOGO" ? 0 : input.value } });
  couponTags();
  await audit(actorId, "coupon.create", "Coupon", c.id, { code: c.code, type: c.type, value: c.value });
  return c;
}

export async function updateCoupon(id: string, input: z.infer<typeof CouponPatch>, actorId: string) {
  const cur = await db.coupon.findUnique({ where: { id } });
  if (!cur) throw err.notFound("Coupon not found");
  const merged = { ...cur, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as typeof cur;
  if (merged.isSponsored && !merged.brandId) throw err.badRequest("Sponsored coupons belong to a brand", { fieldErrors: { brandId: ["Choose the brand"] } });
  if (merged.startsAt && merged.endsAt && merged.endsAt <= merged.startsAt) throw err.badRequest("End must be after the start", { fieldErrors: { endsAt: ["End must be after the start"] } });
  await assertCoupon(input, id);
  const data: Prisma.CouponUncheckedUpdateInput = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) (data as Record<string, unknown>)[k] = v;
  if (merged.type !== "PERCENT") data.maxDiscount = null;
  if (merged.type === "BOGO") data.value = 0;
  const c = await db.coupon.update({ where: { id }, data });
  couponTags();
  const keys = Object.keys(data);
  await audit(actorId, keys.length === 1 && keys[0] === "isActive" ? (input.isActive ? "coupon.enable" : "coupon.disable") : "coupon.update", "Coupon", id, { code: c.code, changed: keys });
  return c;
}

export async function deleteCoupon(id: string, actorId: string) {
  const c = await db.coupon.findUnique({ where: { id }, include: { _count: { select: { uses: true, clips: true } } } });
  if (!c) throw err.notFound("Coupon not found");
  if (c._count.uses) throw err.conflict(`${c.code} has been used on ${c._count.uses} orders — switch it off instead`);
  await db.coupon.delete({ where: { id } });
  couponTags();
  await audit(actorId, "coupon.delete", "Coupon", id, { code: c.code });
  return { id, deleted: true };
}
