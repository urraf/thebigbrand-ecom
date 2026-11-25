import { route } from "@/lib/api";
import { listSlots } from "@/server/admin/growth/slots";

/**
 * GET /api/v1/admin/ads (admin) → { slots: SlotRow[], summary }
 * Every AdSlot with rate, positions, live paid campaigns, fill %, revenue this month, potential and the pause switch state.
 */
export const GET = route({ auth: "admin" }, async () => listSlots());
