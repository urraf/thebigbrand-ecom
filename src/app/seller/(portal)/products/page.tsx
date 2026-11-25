import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { discountPct, formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { ProductRowActions } from "@/components/seller/product-row-actions";
import { Thumb } from "@/components/seller/thumb";
import { PRODUCT_STATUS_LABEL, STATUS_TONE, fmtShort, plural } from "@/components/seller/format";
import { PRODUCT_TABS, listSellerProducts, type ProductTab } from "@/server/seller/products";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Products" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function SellerProductsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead
        title="Products"
        sub="Everything you sell on The Big Brands. New products and content changes are reviewed within 24 working hours."
        actions={
          <>
            <SLink href="/seller/inventory" className="btn btn-ghost btn-sm">
              <Icon name="layers" /> Bulk stock &amp; price
            </SLink>
            <SLink href="/seller/products/new" className="btn btn-cart btn-sm">
              <Icon name="plus" /> Add product
            </SLink>
          </>
        }
      />
      <Suspense fallback={<BodySkeleton rows={[56, 420]} />}>
        <ProductsBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const TAB_LABEL: Record<ProductTab, string> = { all: "All", ACTIVE: "Live", PENDING: "In review", REJECTED: "Rejected", DRAFT: "Drafts", ARCHIVED: "Archived" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function ProductsBody({ searchParams }: { searchParams: SP }) {
  const { seller } = await requireSellerPage("/seller/products");
  const sp = await searchParams;
  const tab = (PRODUCT_TABS as readonly string[]).includes(one(sp.status)) ? (one(sp.status) as ProductTab) : "all";
  const q = one(sp.q).trim().slice(0, 100);
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  const [data, href] = await Promise.all([listSellerProducts(seller.id, { tab, q, page, limit: 20 }), getSellerHref()]);
  const qs = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | number | null> = { status: tab === "all" ? null : tab, q: q || null, page: null, ...over };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    return href(`/seller/products${p.size ? `?${p}` : ""}`);
  };

  return (
    <div className="sl-body">
      {(data.counts.REJECTED ?? 0) > 0 && tab !== "REJECTED" ? (
        <div className="sl-note sl-note-crit">
          <Icon name="info" />
          <span>
            <b>{plural(data.counts.REJECTED ?? 0, "product")} need changes.</b> Open {data.counts.REJECTED === 1 ? "it" : "them"} to see why, fix and resubmit.{" "}
            <Link href={qs({ status: "REJECTED", page: null })} className="link">
              Show rejected
            </Link>
          </span>
        </div>
      ) : null}
      <section className="sl-card">
        <div className="sl-filters" style={{ marginBottom: 14 }}>
          <nav className="sl-tabs" aria-label="Product status">
            {PRODUCT_TABS.map((k) => (
              <Link key={k} href={qs({ status: k === "all" ? null : k })} className={tab === k ? "chip on" : "chip"} aria-current={tab === k ? "page" : undefined}>
                {TAB_LABEL[k]} <span className="sl-chip-n">{data.counts[k] ?? 0}</span>
              </Link>
            ))}
          </nav>
          <Form className="sl-filters" action={href("/seller/products")} role="search" style={{ flex: "1 1 100%" }}>
            {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
            <label className="sl-search">
              <Icon name="search" />
              <span className="sr-only">Search products</span>
              <input type="search" name="q" defaultValue={q} placeholder="Name, SKU or brand" />
            </label>
            <button type="submit" className="btn btn-dark btn-sm">
              Search
            </button>
            {q ? (
              <Link href={qs({ q: null })} className="btn btn-ghost btn-sm">
                Clear
              </Link>
            ) : null}
          </Form>
        </div>

        {data.items.length ? (
          <div className="sl-tscroll sl-tstack">
            <table className="sl-table sl-stack sl-stack-prod">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="r">Price</th>
                  <th>Stock</th>
                  <th className="r">Sold</th>
                  <th>Status</th>
                  <th className="r">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => {
                  const off = discountPct(p.mrp, p.price);
                  const low = p.stock <= 10;
                  return (
                    <tr key={p.id}>
                      <td className="sl-x-full">
                        <div className="sl-prod">
                          <Thumb name={p.name} brand={p.brand.name} image={p.image} art={p.art} />
                          <span>
                            {p.status === "ARCHIVED" ? (
                              <b>{p.name}</b>
                            ) : (
                              <Link href={href(`/seller/products/${p.id}`)}>
                                <b>{p.name}</b>
                              </Link>
                            )}
                            <small>
                              {p.brand.name}
                              {p.size ? ` · ${p.size}` : ""}
                              {p.sku ? ` · ${p.sku}` : ""}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td data-l="Category">{p.category.name}</td>
                      <td className="r num" data-l="Price">
                        <b>{formatINR(p.price)}</b>
                        {off ? (
                          <span className="sl-off">
                            {off}% off {formatINR(p.mrp)}
                          </span>
                        ) : null}
                      </td>
                      <td data-l="Stock">
                        <span className={p.stock === 0 ? "sl-crit-t num" : low ? "sl-warn-t num" : "num"}>{p.stock === 0 ? "Sold out" : p.stock.toLocaleString("en-IN")}</span>
                        <span className={p.stock === 0 || low ? "sl-meter sl-meter-stock crit" : "sl-meter sl-meter-stock"} style={{ ["--p" as string]: Math.min(1, p.stock / 100), marginTop: 6, maxWidth: 90 }}>
                          <i />
                        </span>
                      </td>
                      <td className="r num" data-l="Sold">
                        {p.unitsSold}
                      </td>
                      <td data-l="Status">
                        <Pill tone={STATUS_TONE[p.status]}>{PRODUCT_STATUS_LABEL[p.status]}</Pill>
                        {p.status === "REJECTED" && p.rejectionReason ? (
                          <span className="sl-sub" style={{ maxWidth: 220, color: "var(--sl-crit-t)" }}>
                            {p.rejectionReason}
                          </span>
                        ) : (
                          <span className="sl-sub">Updated {fmtShort(p.updatedAt)}</span>
                        )}
                      </td>
                      <td className="r sl-x-full">
                        <ProductRowActions id={p.id} name={p.name} status={p.status} canDelete={p.status !== "ACTIVE" && !p.hasOrders} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sl-empty">
            <Icon name="bag" />
            <b>{q ? "No products match your search" : tab === "all" ? "List your first product" : `No ${TAB_LABEL[tab].toLowerCase()} products`}</b>
            <p>
              {q
                ? "Try another name, SKU or brand."
                : tab === "all"
                  ? "Add photos, price and stock. Our team checks it for authenticity and it goes live within 24 working hours."
                  : "Nothing here right now."}
            </p>
            {tab === "all" && !q ? (
              <SLink href="/seller/products/new" className="btn btn-cart">
                <Icon name="plus" /> Add product
              </SLink>
            ) : null}
          </div>
        )}

        {data.pages > 1 ? (
          <div className="sl-pager">
            <span>
              Page {data.page} of {data.pages} · {plural(data.total, "product")}
            </span>
            <div>
              {data.page > 1 ? (
                <Link className="btn btn-ghost btn-sm" href={qs({ page: data.page - 1 })}>
                  <Icon name="chevLeft" /> Previous
                </Link>
              ) : null}
              {data.page < data.pages ? (
                <Link className="btn btn-ghost btn-sm" href={qs({ page: data.page + 1 })}>
                  Next <Icon name="chevRight" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
