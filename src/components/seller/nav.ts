/** Seller portal navigation (pages at src/app/seller/(portal)/<path>/page.tsx). Owned by the foundation. */
export type SellerNavItem = { href: string; label: string; icon: string };

export const SELLER_NAV: SellerNavItem[] = [
  { href: "/seller", label: "Dashboard", icon: "grid" },
  { href: "/seller/orders", label: "Orders", icon: "box" },
  { href: "/seller/products", label: "Products", icon: "bag" },
  { href: "/seller/inventory", label: "Inventory", icon: "layers" },
  { href: "/seller/ads", label: "Sponsored ads", icon: "megaphone" },
  { href: "/seller/payouts", label: "Payouts & ledger", icon: "card" },
  { href: "/seller/profile", label: "Business profile", icon: "store" },
];
