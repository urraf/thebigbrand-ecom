import "server-only";
import { headers } from "next/headers";
import { makeSellerHref, type SellerHref } from "@/components/seller/paths";

/**
 * Server Components / Actions: link builder for the current host (reads the Host header → dynamic, so only
 * call it inside a <Suspense> boundary). `href("/seller/orders")` → "/orders" on seller.*, unchanged elsewhere;
 * `href.store("/sell")` → absolute main-store URL when on seller.*.
 */
export async function getSellerHref(): Promise<SellerHref> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "http").replace(/:$/, "") + ":";
  return makeSellerHref(host, proto);
}
