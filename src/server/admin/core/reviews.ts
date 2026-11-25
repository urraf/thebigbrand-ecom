import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";

export const ReviewListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["published", "hidden"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verified: z.enum(["yes", "no"]).optional(),
  product: z.string().trim().max(40).optional(),
  sort: z.enum(["recent", "rating", "helpful"]).default("recent"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReviewListQuery = z.infer<typeof ReviewListQuery>;

export async function listReviews(q: ReviewListQuery) {
  const and: Prisma.ReviewWhereInput[] = [];
  if (q.q) {
    const ci = { contains: q.q, mode: "insensitive" as const };
    and.push({ OR: [{ body: ci }, { title: ci }, { authorName: ci }, { product: { name: ci } }, { product: { brand: { name: ci } } }] });
  }
  if (q.status) and.push({ isPublished: q.status === "published" });
  if (q.rating) and.push({ rating: q.rating });
  if (q.verified) and.push({ verified: q.verified === "yes" });
  if (q.product) and.push({ productId: q.product });
  const where: Prisma.ReviewWhereInput = { AND: and };
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
    q.sort === "rating" ? [{ rating: q.dir }, { createdAt: "desc" }] : q.sort === "helpful" ? [{ helpful: q.dir }, { createdAt: "desc" }] : [{ createdAt: q.dir }];
  const [total, rows] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { product: { select: { id: true, name: true, slug: true, brand: { select: { name: true } } } }, user: { select: { id: true } } },
    }),
  ]);
  return paged(
    rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    q.page,
    q.limit,
  );
}

export async function reviewStats() {
  const [total, hidden, avg, low, byRating] = await Promise.all([
    db.review.count(),
    db.review.count({ where: { isPublished: false } }),
    db.review.aggregate({ where: { isPublished: true }, _avg: { rating: true } }),
    db.review.count({ where: { isPublished: true, rating: { lte: 2 }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    db.review.groupBy({ by: ["rating"], where: { isPublished: true }, _count: { _all: true } }),
  ]);
  const dist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: byRating.find((b) => b.rating === r)?._count._all ?? 0 }));
  return { total, hidden, avg: avg._avg.rating ?? 0, low, dist };
}

/** Keep Product.rating / reviewCount (display aggregates) in step when a review appears or disappears. */
async function shiftAggregate(tx: Prisma.TransactionClient, productId: string, rating: number, delta: 1 | -1) {
  const p = await tx.product.findUnique({ where: { id: productId }, select: { rating: true, reviewCount: true } });
  if (!p) return;
  const count = Math.max(0, p.reviewCount + delta);
  const sum = p.rating * p.reviewCount + delta * rating;
  const next = count ? Math.max(0, Math.min(5, sum / count)) : 0;
  await tx.product.update({ where: { id: productId }, data: { reviewCount: count, rating: Math.round(next * 10) / 10 } });
}

export const ReviewPatch = z.object({ isPublished: z.boolean() });

export async function setReviewPublished(id: string, isPublished: boolean, actorId: string) {
  const r = await db.review.findUnique({ where: { id }, include: { product: { select: { slug: true, name: true } } } });
  if (!r) throw err.notFound("Review not found");
  if (r.isPublished === isPublished) return { id, isPublished };
  await db.$transaction(async (tx) => {
    await tx.review.update({ where: { id }, data: { isPublished } });
    await shiftAggregate(tx, r.productId, r.rating, isPublished ? 1 : -1);
  });
  invalidate(TAGS.reviews(r.productId), TAGS.product(r.productId), TAGS.product(r.product.slug), TAGS.products);
  await audit(actorId, isPublished ? "review.publish" : "review.hide", "Review", id, { product: r.product.name, rating: r.rating, author: r.authorName });
  return { id, isPublished };
}

export async function deleteReview(id: string, actorId: string) {
  const r = await db.review.findUnique({ where: { id }, include: { product: { select: { slug: true, name: true } } } });
  if (!r) throw err.notFound("Review not found");
  await db.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    if (r.isPublished) await shiftAggregate(tx, r.productId, r.rating, -1);
  });
  invalidate(TAGS.reviews(r.productId), TAGS.product(r.productId), TAGS.product(r.product.slug), TAGS.products);
  await audit(actorId, "review.delete", "Review", id, { product: r.product.name, rating: r.rating, author: r.authorName, body: r.body.slice(0, 200) });
  return { id, deleted: true };
}
