import "server-only";
import { db } from "@/lib/db";

export type AdminSearchHit = { type: "order" | "product" | "customer" | "brand" | "seller"; id: string; title: string; sub: string; href: string };

/** Top-bar search across orders, products, customers, brands and sellers (max ~5 each). */
export async function adminSearch(raw: string): Promise<AdminSearchHit[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const ci = { contains: q, mode: "insensitive" as const };
  const digits = q.replace(/\D/g, "");
  const [orders, products, customers, brands, sellers] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          { number: ci },
          { shipName: ci },
          ...(digits.length >= 4 ? [{ shipPhone: { contains: digits } }] : []),
          { user: { OR: [{ email: ci }, { name: ci }] } },
        ],
      },
      select: { number: true, shipName: true, shipCity: true, total: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.product.findMany({
      where: { OR: [{ name: ci }, { sku: ci }, { slug: ci }, { brand: { name: ci } }] },
      select: { id: true, name: true, sku: true, status: true, brand: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.user.findMany({
      where: {
        role: "CUSTOMER",
        OR: [{ name: ci }, { email: ci }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])],
      },
      select: { id: true, name: true, email: true, phone: true },
      take: 5,
    }),
    db.brand.findMany({ where: { name: ci }, select: { id: true, name: true, slug: true }, take: 4 }),
    db.seller.findMany({ where: { OR: [{ displayName: ci }, { businessName: ci }, { email: ci }] }, select: { id: true, displayName: true, status: true }, take: 3 }),
  ]);
  return [
    ...orders.map((o) => ({
      type: "order" as const,
      id: o.number,
      title: o.number,
      sub: `${o.shipName} · ${o.shipCity} · ₹${o.total.toLocaleString("en-IN")}`,
      href: `/admin/orders/${o.number}`,
    })),
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      title: p.name,
      sub: `${p.brand.name}${p.sku ? ` · ${p.sku}` : ""}${p.status !== "ACTIVE" ? ` · ${p.status.toLowerCase()}` : ""}`,
      href: `/admin/products/${p.id}`,
    })),
    ...customers.map((u) => ({
      type: "customer" as const,
      id: u.id,
      title: u.name || u.email || u.phone || "Customer",
      sub: [u.email, u.phone].filter(Boolean).join(" · "),
      href: `/admin/customers/${u.id}`,
    })),
    ...brands.map((b) => ({ type: "brand" as const, id: b.id, title: b.name, sub: `/${b.slug}`, href: `/admin/brands?q=${encodeURIComponent(b.name)}` })),
    ...sellers.map((s) => ({ type: "seller" as const, id: s.id, title: s.displayName, sub: `Seller · ${s.status.toLowerCase()}`, href: `/admin/sellers?q=${encodeURIComponent(s.displayName)}` })),
  ];
}
