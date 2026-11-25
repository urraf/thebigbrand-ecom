import { requireAdminPage } from "@/lib/auth";
import { UserMenu } from "./user-menu";

/** Reads the session (render inside <Suspense fallback={<UserMenuFallback />}>). */
export async function UserMenuServer() {
  const auth = await requireAdminPage();
  const u = auth.user;
  return <UserMenu name={u.name || u.email || "Admin"} email={u.email} role={u.role} />;
}

export function UserMenuFallback() {
  return <span className="am-me-sk" aria-hidden="true" />;
}
