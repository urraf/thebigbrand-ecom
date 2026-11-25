import "server-only";
import { redirect } from "next/navigation";
import { requireAdminPage, type AuthContext } from "@/lib/auth";
import { err } from "@/lib/api";

/** Page guard for ADMIN-only pages (settings, audit). STAFF are sent back to the dashboard. */
export async function requireSuperAdminPage(nextPath: string): Promise<AuthContext> {
  const auth = await requireAdminPage(nextPath);
  if (auth.user.role !== "ADMIN") redirect("/admin?denied=1");
  return auth;
}

/** Actor string stored on OrderEvent rows by the lifecycle. */
export const adminActor = (userId: string) => `admin:${userId}`;

/** Map lifecycle errors (thrown as plain Errors) to API errors. */
export function lifecycleError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "ORDER_NOT_PAID") throw err.conflict("This order hasn't been paid yet — it can only be cancelled");
  if (msg.startsWith("INVALID_TRANSITION:")) {
    const [from, to] = msg.slice("INVALID_TRANSITION:".length).split("->");
    throw err.conflict(`Can't move an item from ${from.toLowerCase()} to ${to.toLowerCase()}`);
  }
  if (msg === "FORBIDDEN_ITEM") throw err.forbidden();
  if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2025") throw err.notFound("Order item not found");
  throw e;
}
