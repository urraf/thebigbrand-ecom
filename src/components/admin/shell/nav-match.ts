import { ADMIN_NAV, type AdminNavItem } from "@/components/admin/nav";

/** The sidebar item that owns `pathname` (longest matching href; "/admin" only matches exactly). */
export function activeNavItem(pathname: string): { item: AdminNavItem; group: string } | null {
  let best: { item: AdminNavItem; group: string } | null = null;
  for (const g of ADMIN_NAV) {
    for (const item of g.items) {
      const hit = item.href === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname === item.href || pathname.startsWith(item.href + "/");
      if (hit && (!best || item.href.length > best.item.href.length)) best = { item, group: g.label };
    }
  }
  return best;
}
