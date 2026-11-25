import { route } from "@/lib/api";
import { getCredits } from "@/server/catalog/credits";

/** GET /api/v1/catalog/credits → image credits (licence, creator, source, modification notes). */
export const GET = route({ auth: "public" }, async () => getCredits());
