import "server-only";
import { db } from "@/lib/db";
import { invalidate, TAGS } from "@/lib/cache";

/**
 * "Helpful" votes on reviews. One vote per voter (signed-in user id, else IP + user agent) per review per
 * server instance; the browser also remembers its votes. Increments Review.helpful atomically.
 */
const voted = new Map<string, number>();
const TTL = 1000 * 60 * 60 * 24 * 30;

export async function markReviewHelpful(reviewId: string, voterKey: string): Promise<{ id: string; helpful: number; counted: boolean } | null> {
  const review = await db.review.findFirst({
    where: { id: reviewId, isPublished: true, product: { status: "ACTIVE" } },
    select: { id: true, helpful: true, productId: true },
  });
  if (!review) return null;
  const key = `${voterKey}|${reviewId}`;
  const now = Date.now();
  const prev = voted.get(key);
  if (prev && now - prev < TTL) return { id: review.id, helpful: review.helpful, counted: false };
  voted.set(key, now);
  if (voted.size > 50_000) {
    for (const [k, t] of voted) if (now - t > TTL) voted.delete(k);
  }
  const updated = await db.review.update({ where: { id: review.id }, data: { helpful: { increment: 1 } }, select: { helpful: true } });
  invalidate(TAGS.reviews(review.productId));
  return { id: review.id, helpful: updated.helpful, counted: true };
}
