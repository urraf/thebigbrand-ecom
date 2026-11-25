import { route } from "@/lib/api";
import { editorOptions } from "@/server/admin/growth/campaigns";

/** GET /api/v1/admin/campaigns/options (admin) → { slots, advertisers, brands } for campaign forms */
export const GET = route({ auth: "admin" }, async () => editorOptions());
