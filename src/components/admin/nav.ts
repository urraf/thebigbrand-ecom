/**
 * Admin console navigation — single source of truth for the sidebar (owned by the foundation).
 * Pages live at src/app/admin/(console)/<path>/page.tsx. `owner` = which build agent implements the page.
 */
export type AdminNavItem = { href: string; label: string; icon: string; owner: "admin-core" | "admin-growth"; superadminOnly?: boolean };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "grid", owner: "admin-core" },
      { href: "/admin/revenue", label: "Revenue", icon: "chart", owner: "admin-growth" },
    ],
  },
  {
    label: "Advertising",
    items: [
      { href: "/admin/ads", label: "Ads Manager", icon: "megaphone", owner: "admin-growth" },
      { href: "/admin/campaigns", label: "Campaigns", icon: "layers", owner: "admin-growth" },
      { href: "/admin/advertisers", label: "Advertisers", icon: "users", owner: "admin-growth" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/admin/sellers", label: "Sellers", icon: "store", owner: "admin-growth" },
      { href: "/admin/payouts", label: "Payouts & ledger", icon: "card", owner: "admin-growth" },
      { href: "/admin/approvals", label: "Product approvals", icon: "check", owner: "admin-core" },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "box", owner: "admin-core" },
      { href: "/admin/products", label: "Products", icon: "bag", owner: "admin-core" },
      { href: "/admin/brands", label: "Brands & categories", icon: "tag", owner: "admin-core" },
      { href: "/admin/customers", label: "Customers", icon: "user", owner: "admin-core" },
      { href: "/admin/reviews", label: "Reviews", icon: "star", owner: "admin-core" },
      { href: "/admin/messages", label: "Messages", icon: "info", owner: "admin-core" },
    ],
  },
  {
    label: "Promotions",
    items: [
      { href: "/admin/gifts", label: "Free gifts", icon: "gift", owner: "admin-core" },
      { href: "/admin/coupons", label: "Coupons", icon: "percent", owner: "admin-core" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "sliders", owner: "admin-core", superadminOnly: true },
      { href: "/admin/audit", label: "Audit log", icon: "shield", owner: "admin-core", superadminOnly: true },
    ],
  },
];
