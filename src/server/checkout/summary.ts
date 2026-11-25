import "server-only";
import type { AuthUser } from "@/lib/auth";
import { publicGatewayConfig } from "@/lib/payments";
import { listAddresses } from "@/server/account/addresses";
import { getCartView } from "@/server/cart/service";
import { getGiftCatalog } from "@/server/gifts/service";
import { buildQuote } from "./quote";
import type { CheckoutSummary } from "./types";

/** Everything the checkout needs in one call: cart, quote, gift picker, saved addresses and payment options. */
export async function getCheckoutSummary(user: AuthUser): Promise<CheckoutSummary> {
  const [cart, catalog, addresses] = await Promise.all([getCartView({ userId: user.id, guestToken: null }), getGiftCatalog(), listAddresses(user.id)]);
  const quote = await buildQuote(cart, user.id);
  const gw = publicGatewayConfig();
  return {
    cart,
    quote,
    gifts: catalog.gifts,
    tiers: catalog.tiers,
    addresses,
    payment: { mode: gw.mode, keyId: gw.keyId, codEnabled: quote.codEnabled, codFee: quote.codFee },
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
  };
}
