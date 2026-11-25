import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { InventorySheet } from "@/components/seller/inventory-sheet";
import { plural } from "@/components/seller/format";
import { listSellerProducts } from "@/server/seller/products";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Inventory" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function InventoryPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead
        title="Inventory"
        sub="Update stock and prices for many products at once. Changes go live immediately — no review needed."
        actions={
          <SLink href="/seller/products/new" className="btn btn-ghost btn-sm">
            <Icon name="plus" /> Add product
          </SLink>
        }
      />
      <Suspense fallback={<BodySkeleton rows={[56, 420]} />}>
        <InventoryBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InventoryBody({ searchParams }: { searchParams: SP }) {
  const { seller } = await requireSellerPage("/seller/inventory");
  const sp = await searchParams;
  const low = one(sp.lowStock) === "1";
  const view = one(sp.view) === "all" ? "all" : "live";
  const q = one(sp.q).trim().slice(0, 100);
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  const [data, href] = await Promise.all([
    listSellerProducts(seller.id, { tab: low ? "ACTIVE" : view === "all" ? "all" : "ACTIVE", q, page, limit: 50, lowStock: low }),
    getSellerHref(),
  ]);
  const rows = data.items
    .filter((p) => p.status !== "ARCHIVED")
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand.name, size: p.size, sku: p.sku, status: p.status, mrp: p.mrp, price: p.price, stock: p.stock, unitsSold: p.unitsSold, image: p.image, art: p.art }));
  const link = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { view: view === "all" ? "all" : null, lowStock: low ? "1" : null, q: q || null, ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return href(`/seller/inventory${p.size ? `?${p}` : ""}`);
  };

  return (
    <div className="sl-body">
      <section className="sl-card">
        <div className="sl-filters" style={{ marginBottom: 14 }}>
          <nav className="sl-tabs" aria-label="Inventory view">
            <Link href={link({ view: null, lowStock: null })} className={!low && view === "live" ? "chip solo on" : "chip solo"}>
              Live products
            </Link>
            <Link href={link({ view: "all", lowStock: null })} className={!low && view === "all" ? "chip solo on" : "chip solo"}>
              All (incl. drafts &amp; in review)
            </Link>
            <Link href={link({ view: null, lowStock: "1" })} className={low ? "chip solo on" : "chip solo"}>
              <Icon name="info" size={15} /> Low stock (≤ 10)
            </Link>
          </nav>
          <Form className="sl-filters" action={href("/seller/inventory")} role="search" style={{ flex: "1 1 100%" }}>
            {view === "all" ? <input type="hidden" name="view" value="all" /> : null}
            {low ? <input type="hidden" name="lowStock" value="1" /> : null}
            <label className="sl-search">
              <Icon name="search" />
              <span className="sr-only">Search inventory</span>
              <input type="search" name="q" defaultValue={q} placeholder="Name, SKU or brand" />
            </label>
            <button type="submit" className="btn btn-dark btn-sm">
              Search
            </button>
          </Form>
        </div>
        {rows.length ? (
          <>
            <InventorySheet key={rows.map((r) => `${r.id}:${r.stock}:${r.price}`).join("|")} rows={rows} />
            {data.pages > 1 ? (
              <div className="sl-pager">
                <span>
                  Page {data.page} of {data.pages} · {plural(data.total, "product")}
                </span>
                <div>
                  {data.page > 1 ? (
                    <Link className="btn btn-ghost btn-sm" href={link({ page: String(data.page - 1) })}>
                      Previous
                    </Link>
                  ) : null}
                  {data.page < data.pages ? (
                    <Link className="btn btn-ghost btn-sm" href={link({ page: String(data.page + 1) })}>
                      Next
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="sl-empty">
            <Icon name={low ? "check" : "layers"} />
            <b>{low ? "No low-stock products" : q ? "Nothing matches your search" : "No products to manage yet"}</b>
            <p>{low ? "Every live product has more than 10 units. Nice!" : "Add a product and its stock shows up here."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
