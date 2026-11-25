import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { setSellerProductState } from "@/server/seller/products";

const Body = z.object({ action: z.enum(["archive", "restore", "submit"]) });

/** POST /api/v1/seller/products/:id/status { action: archive | restore | submit } */
export const POST = route<{ id: string }>({ auth: "seller" }, async ({ req, params, auth, seller }) => {
  const { action } = await parseBody(req, Body);
  return setSellerProductState(seller!, auth!.user.id, params.id, action);
});
