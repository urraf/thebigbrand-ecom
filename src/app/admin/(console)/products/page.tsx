import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { discountPct, formatINR } from "@/lib/money";
import { listProducts, LOW_STOCK, productFormOptions, ProductListQuery, productStats } from "@/server/admin/core/products";
import { StockCell } from "@/components/admin/core/stock-cell";
import { Card, DataTable, EmptyState, PageHeader, Pagination, SkeletonPage, StatCard, StatGrid, StatusPill, Toolbar, flatParams, type SearchParamsInput } from "@/components/admin/ui";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ProductImage } from "@/components/ui/product-image";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Products" };

async function Products({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/products");
  const params = flatParams(await searchParams);
  const parsed = ProductListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : ProductListQuery.parse({});
  const [list, stats, opts] = await Promise.all([listProducts(q), productStats(), productFormOptions()]);

  return (
    <>
      <StatGrid label="Catalogue summary">
        <StatCard label="Live listings" value={stats.live} sub={`${opts.brands.length} brands · ${stats.total} products in the catalogue`} href="/admin/products?status=ACTIVE" />
        <StatCard label="Awaiting approval" value={stats.pending} sub="Submitted by sellers" href="/admin/approvals" tone={stats.pending ? "cta" : undefined} />
        <StatCard label="Low stock" value={stats.low} sub={`${LOW_STOCK} units or fewer`} href="/admin/products?stock=low" tone={stats.low ? "warn" : undefined} />
        <StatCard label="Out of stock" value={stats.out} sub="Can't be added to cart" href="/admin/products?stock=out" tone={stats.out ? "crit" : undefined} />
      </StatGrid>
      <Card title="Catalogue" sub={`${list.total} product${list.total === 1 ? "" : "s"} match · edit stock right in the table`} id="am-products">
        <Toolbar
          search={{ placeholder: "Name, SKU, brand or tag…" }}
          filters={[
            { param: "brand", label: "Brand", allLabel: "All brands", options: opts.brands.map((b) => ({ value: b.slug, label: b.name })) },
            { param: "category", label: "Category", allLabel: "All categories", options: opts.categories.map((c) => ({ value: c.slug, label: c.name })) },
            { param: "seller", label: "Seller", allLabel: "All sellers", options: [{ value: "tbb", label: "The Big Brands Retail" }, ...opts.sellers.map((s) => ({ value: s.id, label: s.displayName }))] },
            {
              param: "status",
              label: "Status",
              allLabel: "Any status",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "DRAFT", label: "Draft" },
                { value: "PENDING", label: "Awaiting approval" },
                { value: "REJECTED", label: "Rejected" },
                { value: "ARCHIVED", label: "Archived" },
              ],
            },
            {
              param: "stock",
              label: "Stock",
              allLabel: "Any stock",
              options: [
                { value: "in", label: "In stock" },
                { value: "low", label: "Low stock" },
                { value: "out", label: "Out of stock" },
              ],
            },
          ]}
        />
        <DataTable
          basePath="/admin/products"
          params={params}
          sort={{ by: q.sort, dir: q.dir }}
          rows={list.items}
          rowKey={(p) => p.id}
          rowClassName={(p) => (p.status === "ARCHIVED" ? "is-off" : undefined)}
          minWidth={980}
          empty={
            <EmptyState icon="bag" title="No products match" action={<Link className="btn btn-dark btn-sm" href="/admin/products/new">Add a product</Link>}>
              Try clearing the filters.
            </EmptyState>
          }
          columns={[
            {
              key: "name",
              label: "Product",
              sortable: "name",
              main: true,
              render: (p) => (
                <div className="am-prod">
                  <Link href={`/admin/products/${p.id}`} className="am-thumb-l" aria-label={`Edit ${p.name}`}>
                    <ProductImage className="am-thumb" sizes="48px" product={{ name: p.name, image: p.image ? { ...p.image, width: null, height: null } : null, art: p.art, isOwnLabel: p.isOwnLabel, brand: p.brand }} />
                  </Link>
                  <span>
                    <Link href={`/admin/products/${p.id}`} className="am-rowlink">
                      {p.name}
                    </Link>
                    <small>
                      {p.sku ? p.sku : "No SKU"}
                      {p.size ? ` · ${p.size}` : ""}
                      {` · ${p.seller?.displayName ?? "TBB Retail"}`}
                      {p.isGift ? " · gift mini" : ""}
                    </small>
                  </span>
                </div>
              ),
            },
            {
              key: "brand",
              label: "Brand · category",
              mobileLabel: "Brand",
              className: "am-blogo",
              render: (p) => (
                <>
                  <BrandLogo brand={p.brand} size={13} showSub={false} />
                  <small className="am-sub">{p.category.name}</small>
                </>
              ),
            },
            {
              key: "price",
              label: "Price",
              align: "right",
              sortable: "price",
              render: (p) => (
                <>
                  <b className="num">{formatINR(p.price)}</b>
                  {p.mrp > p.price ? <small className="am-sub nowrap"><s>{formatINR(p.mrp)}</s> · {discountPct(p.mrp, p.price)}% off</small> : null}
                </>
              ),
            },
            { key: "stock", label: "Stock", align: "right", sortable: "stock", render: (p) => <StockCell id={p.id} stock={p.stock} low={LOW_STOCK} /> },
            { key: "sold", label: "Sold", align: "right", sortable: "sold", hideMobile: true, render: (p) => <span className="num">{p.soldCount.toLocaleString("en-IN")}</span> },
            {
              key: "pz",
              label: "Ad placements",
              hideMobile: true,
              render: (p) =>
                p.placements.length ? (
                  <span className="am-adchips">
                    {p.placements.map((s) => (
                      <span key={s} className="am-tag am-tag-pz">
                        {s}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="am-muted">—</span>
                ),
            },
            { key: "status", label: "Status", render: (p) => <StatusPill kind="product" status={p.status} /> },
            {
              key: "act",
              label: "",
              actions: true,
              align: "right",
              render: (p) => (
                <Link className="btn btn-ghost btn-sm" href={`/admin/products/${p.id}`}>
                  Edit
                </Link>
              ),
            },
          ]}
        />
        <Pagination basePath="/admin/products" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="products" />
      </Card>
    </>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader
        title="Products"
        sub="Your marketplace catalogue across all brands and sellers."
        actions={
          <Link className="btn btn-dark btn-sm" href="/admin/products/new">
            <Icon name="plus" />
            Add product
          </Link>
        }
      />
      <Suspense fallback={<SkeletonPage />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </>
  );
}
