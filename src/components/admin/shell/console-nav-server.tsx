import { requireAdminPage } from "@/lib/auth";
import { getPendingCounts, navBadges } from "@/server/admin/core/counts";
import Link from "next/link";
import { ADMIN_NAV } from "@/components/admin/nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { ConsoleNav } from "./console-nav";

/** Session-aware sidebar: hides ADMIN-only items for STAFF and shows pending-count badges. Render in <Suspense>. */
export async function ConsoleNavServer() {
  const auth = await requireAdminPage();
  const counts = await getPendingCounts();
  return <ConsoleNav isSuper={auth.user.role === "ADMIN"} badges={navBadges(counts)} />;
}

/**
 * Static fallback while the session streams in: same links, no ADMIN-only items, no badges and no active
 * state (reading the pathname here would make the static shell depend on the URL).
 */
export function ConsoleNavFallback() {
  return (
    <nav className="am-nav" aria-label="Admin sections">
      {ADMIN_NAV.map((g) => {
        const items = g.items.filter((i) => !i.superadminOnly);
        return (
          <div key={g.label} style={{ display: "contents" }}>
            <span className="am-nav-h">{g.label}</span>
            {items.map((i) => (
              <Link key={i.href} href={i.href}>
                <Icon name={i.icon as IconName} />
                <span>{i.label}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
