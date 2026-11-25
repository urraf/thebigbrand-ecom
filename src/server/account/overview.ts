import "server-only";
import { db } from "@/lib/db";
import { getAccountStats, listOrders } from "@/server/orders/customer";
import { addressSelect } from "./addresses";
import { getProfile } from "./profile";

/** Account home: profile, order / savings stats, the 3 latest orders, default address and wishlist count. */
export async function getAccountOverview(userId: string) {
  const [profile, stats, recent, defaultAddress, wishlistCount] = await Promise.all([
    getProfile(userId),
    getAccountStats(userId),
    listOrders(userId, { status: "all", page: 1, limit: 3 }),
    db.address.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: addressSelect }),
    db.wishlistItem.count({ where: { userId } }),
  ]);
  return { profile, stats, recentOrders: recent.items, orderCounts: recent.counts, defaultAddress, wishlistCount };
}
export type AccountOverview = Awaited<ReturnType<typeof getAccountOverview>>;
