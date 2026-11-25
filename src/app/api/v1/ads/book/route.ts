import { clientIp } from "@/lib/auth";
import { err, rateLimit, route } from "@/lib/api";
import { bookCampaign, listMyBookings } from "@/server/ads/booking";

/**
 * POST /api/v1/ads/book  (signed in)  — self-serve campaign booking.
 *   Brand / advertiser body: { slotCode, brandId | brandSlug, companyName?, contactName?, email?, phone?, gstin?,
 *     headline, subline?, ctaLabel?, linkUrl?, color?, imageUrl?, mobileImageUrl?, productIds?, keywords?,
 *     startDate: "YYYY-MM-DD", endDate, budget? (CPM/CPC slots, ₹ excl. GST), agree: true }
 *   Approved seller body: { asSeller: true, slotCode: "S3" | "P1", productIds: [own ACTIVE product ids], startDate,
 *     endDate, budget, agree: true, headline? }
 *   → 200 { data: { campaign: BookingView (status PENDING_REVIEW, paymentStatus UNPAID), payment, quote } }
 *   Then pay: Razorpay Checkout with payment.providerOrderId (mode RAZORPAY) or the TEST gateway, and confirm with
 *   POST /api/v1/ads/book/[code]/pay/verify. Admin approves in the console; the ad serves once approved.
 * GET /api/v1/ads/book  (signed in)   → the signed-in user's bookings (BookingView[])
 */
export const POST = route({ auth: "user" }, async ({ req, auth }) => {
  rateLimit(`adbook:${auth!.user.id}`, 10, 10 * 60_000);
  rateLimit(`adbook-ip:${clientIp(req) ?? "anon"}`, 30, 10 * 60_000);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw err.badRequest("Request body must be valid JSON");
  }
  return bookCampaign(auth!, raw, { ip: clientIp(req) });
});

export const GET = route({ auth: "user" }, async ({ auth }) => listMyBookings(auth!));
