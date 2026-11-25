import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConsoleLogo } from "@/components/admin/shell/brand";
import { AdminSearch } from "@/components/admin/shell/admin-search";
import { ConsoleNavFallback, ConsoleNavServer } from "@/components/admin/shell/console-nav-server";
import { Crumb } from "@/components/admin/shell/crumb";
import { UserMenuFallback, UserMenuServer } from "@/components/admin/shell/user-menu-server";
import { Icon } from "@/components/ui/icon";
import { Toaster } from "@/components/ui/toast";
import "@/styles/admin/admin.css";
import "@/styles/admin/core.css";

export const metadata: Metadata = {
  title: { default: "Admin console", template: "%s · TBB Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin console shell (no store chrome): dark sidebar from ADMIN_NAV, sticky top bar (location, search,
 * view store, user menu) and the page body. The frame is static; the session-aware parts (role-filtered nav
 * with pending badges, user menu) stream into <Suspense> slots. Every page guards itself too
 * (requireAdminPage / requireSuperAdminPage) and the proxy redirects signed-out visitors to /admin/login.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="am">
      <aside className="am-side">
        <div className="am-side-top">
          <ConsoleLogo />
          <Link className="am-store am-store-m" href="/" target="_blank" aria-label="View store">
            <Icon name="store" />
            <span>Store</span>
          </Link>
        </div>
        <Suspense fallback={<ConsoleNavFallback />}>
          <ConsoleNavServer />
        </Suspense>
        <div className="am-app">
          <span className="am-app-ic">
            <Icon name="phone" />
          </span>
          <b>Admin app on Android &amp; iOS</b>
          <p>Approve products, ship orders and restock gifts from your phone — the same API powers both.</p>
          <div className="am-app-b">
            <span>Android</span>
            <span>iOS</span>
          </div>
        </div>
        <Link className="am-store am-store-d" href="/" target="_blank">
          <Icon name="store" />
          <span>View store</span>
          <Icon name="arrow" />
        </Link>
      </aside>
      <div className="am-main">
        <header className="am-top">
          <Suspense fallback={<div className="am-crumb"><b>Admin console</b></div>}>
            <Crumb />
          </Suspense>
          <AdminSearch />
          <Link className="am-viewstore" href="/" target="_blank" aria-label="View store (opens in a new tab)">
            <Icon name="store" />
            <span>View store</span>
          </Link>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenuServer />
          </Suspense>
        </header>
        <main className="am-body" id="main">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
