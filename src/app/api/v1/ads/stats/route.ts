import { route } from "@/lib/api";
import { getAudienceStats } from "@/server/ads/audience";

/** GET /api/v1/ads/stats → live audience & delivery figures shown on the Advertise page (AudienceStats). */
export const GET = route({ auth: "public" }, async () => getAudienceStats());
