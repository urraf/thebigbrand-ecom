import "server-only";

/**
 * Merge a guest cart (cookie `tbb_cart`) into the signed-in user's cart after login.
 * OWNER: store-kit agent (cart core). Called by the auth routes after a successful login.
 * Placeholder until the cart service lands — must stay safe to call (never throw).
 */
export async function mergeGuestCart(_userId: string, _guestToken: string | undefined | null): Promise<void> {
  return;
}
