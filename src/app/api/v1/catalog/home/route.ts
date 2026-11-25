import { route } from "@/lib/api";
import { getHomeSections } from "@/server/catalog/home";

/**
 * GET /api/v1/catalog/home → { sections: HomeSection[] } — the homepage in display order. Paid placements
 * carry their ad `slot` code (H1…H11) and served creatives with tracked click URLs; house sections
 * (free-gift programme, TBB Originals, trending searches) have slot null.
 */
export const GET = route({ auth: "public" }, async () => ({ sections: await getHomeSections() }));
