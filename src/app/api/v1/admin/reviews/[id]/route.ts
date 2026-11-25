import { parseBody, route } from "@/lib/api";
import { deleteReview, ReviewPatch, setReviewPublished } from "@/server/admin/core/reviews";

/** PATCH /api/v1/admin/reviews/:id { isPublished } — publish or hide (keeps the product's rating/count in step). */
export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, auth }) => {
  const { isPublished } = await parseBody(req, ReviewPatch);
  return setReviewPublished(params.id, isPublished, auth!.user.id);
});

/** DELETE /api/v1/admin/reviews/:id — remove permanently (spam/abuse). */
export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, auth }) => deleteReview(params.id, auth!.user.id));
