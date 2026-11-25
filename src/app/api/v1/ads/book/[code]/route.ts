import { route } from "@/lib/api";
import { getBooking } from "@/server/ads/booking";

/** GET /api/v1/ads/book/[code]  (signed in, booker only) → BookingView with status, payment and delivery totals */
export const GET = route<{ code: string }>({ auth: "user" }, async ({ params, auth }) => getBooking(auth!, params.code));
