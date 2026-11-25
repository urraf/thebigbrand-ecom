import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { changeSellerCampaign } from "@/server/seller/ads";

const Body = z.object({ action: z.enum(["pause", "resume", "withdraw"]) });

/** PATCH /api/v1/seller/ads/:id { action: pause | resume | withdraw } — control my own campaign. */
export const PATCH = route<{ id: string }>({ auth: "seller" }, async ({ req, params, auth, seller }) => {
  const { action } = await parseBody(req, Body);
  return changeSellerCampaign(seller!, auth!.user.id, params.id, action);
});
