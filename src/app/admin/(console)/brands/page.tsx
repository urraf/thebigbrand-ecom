import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { BRAND_FONTS, listBrands, listCategories } from "@/server/admin/core/brands";
import { BrandEditor, CategoryEditor } from "@/components/admin/core/brand-editor";
import { ApiSwitch, Card, DataTable, EmptyState, LinkTabs, PageHeader, SkeletonTable, Toolbar, fmtDate, flatParams, type SearchParamsInput } from "@/components/admin/ui";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata = { title: "Brands & categories" };

async function Content({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/brands");
  const params = flatParams(await searchParams);
  const tab = params.tab === "categories" ? "categories" : "brands";
  const [brands, categories] = await Promise.all([listBrands(params.q), listCategories()]);
  const tabs = (
    <LinkTabs
      label="Catalogue structure"
      items={[
        { href: "/admin/brands", label: "Brands", active: tab === "brands", count: brands.length },
        { href: "/admin/brands?tab=categories", label: "Categories", active: tab === "categories", count: categories.length },
      ]}
    />
  );

  if (tab === "categories") {
    const parents = categories.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name }));
    return (
      <>
        {tabs}
        <Card title="Categories" sub="The store menu, category pages and search filters. Hide a category to take it off the menus without touching its products." actions={<CategoryEditor trigger="new" parents={parents} />} id="am-cats">
          <DataTable
            rows={categories}
            rowKey={(c) => c.id}
            rowClassName={(c) => (c.isActive ? undefined : "is-off")}
            empty={<EmptyState icon="grid" title="No categories yet" />}
            columns={[
              {
                key: "name",
                label: "Category",
                main: true,
                render: (c) => (
                  <span className="am-catn">
                    <b>{c.name}</b>
                    <small>
                      /c/{c.slug}
                      {c.parent ? ` · in ${c.parent.name}` : ""}
                      {c.short && c.short !== c.name ? ` · menu: ${c.short}` : ""}
                    </small>
                  </span>
                ),
              },
              { key: "p", label: "Products", align: "right", render: (c) => <span className="num"><b>{c.activeProducts}</b> live · {c.productCount} total</span> },
              { key: "sort", label: "Order", align: "right", render: (c) => <span className="num">{c.sortOrder}</span> },
              {
                key: "vis",
                label: "On the store",
                className: "am-keep",
                render: (c) => <ApiSwitch checked={c.isActive} url={`/api/v1/admin/categories/${c.id}`} field="isActive" label={`${c.name} visible on the store`} showState onText="Visible" offText="Hidden" successOn={`${c.name} is back on the store`} successOff={`${c.name} hidden from the store`} />,
              },
              {
                key: "act",
                label: "",
                align: "right",
                actions: true,
                className: "am-keep",
                render: (c) => (
                  <span className="am-rowact">
                    <Link className="btn btn-ghost btn-sm" href={`/admin/products?category=${c.slug}`}>
                      Products
                    </Link>
                    <CategoryEditor trigger="edit" category={c} parents={parents} />
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </>
    );
  }

  const stores = brands.filter((b) => b.storeActive).length;
  return (
    <>
      {tabs}
      <Card
        title="Brands"
        sub={`${brands.length} brands · ${stores} with a live brand store (ad slot B1). Switch a store off and its page falls back to the standard brand listing.`}
        actions={<BrandEditor trigger="new" fonts={BRAND_FONTS} />}
        id="am-brands"
      >
        <Toolbar search={{ placeholder: "Search brands…" }} />
        <DataTable
          rows={brands}
          rowKey={(b) => b.id}
          minWidth={900}
          empty={<EmptyState icon="tag" title="No brands match" />}
          columns={[
            {
              key: "logo",
              label: "Brand",
              main: true,
              render: (b) => (
                <div className="am-brandc">
                  <span className="am-brandc-l">
                    <BrandLogo brand={b} size={15} />
                  </span>
                  <span>
                    <b>
                      {b.name}
                      {b.isOwn ? <span className="am-tag am-tag-own">TBB Originals</span> : null}
                      {b.featured ? <span className="am-tag">Featured</span> : null}
                    </b>
                    <small>/brand/{b.slug}{b.tagline ? ` · ${b.tagline}` : ""}</small>
                  </span>
                </div>
              ),
            },
            {
              key: "p",
              label: "Products",
              align: "right",
              render: (b) => (
                <Link href={`/admin/products?brand=${b.slug}`} className="num am-rowlink">
                  {b.activeProducts} live · {b.productCount}
                </Link>
              ),
            },
            { key: "c", label: "Campaigns · coupons", align: "right", hideMobile: true, render: (b) => <span className="num am-muted">{b.campaignCount} · {b.couponCount}</span> },
            {
              key: "store",
              label: "Brand store (B1)",
              className: "am-keep",
              render: (b) => (
                <span className="am-storec">
                  <ApiSwitch checked={b.storeActive} url={`/api/v1/admin/brands/${b.id}`} field="storeActive" label={`${b.name} brand store`} showState onText="Live" offText="Off" successOn={`${b.name} brand store is live`} successOff={`${b.name} brand store switched off`} />
                  {b.storeActive && b.storeActiveUntil ? <small className="am-sub">paid until {fmtDate(b.storeActiveUntil)}</small> : null}
                </span>
              ),
            },
            {
              key: "act",
              label: "",
              align: "right",
              actions: true,
              className: "am-keep",
              render: (b) => (
                <span className="am-rowact">
                  <Link className="btn btn-ghost btn-sm" href={`/brand/${b.slug}`} target="_blank">
                    View
                  </Link>
                  <BrandEditor trigger="edit" brand={b} fonts={BRAND_FONTS} />
                </span>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

export default function BrandsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Brands & categories" sub="Brand wordmarks, paid brand stores and the category tree shoppers browse." />
      <Suspense fallback={<SkeletonTable rows={10} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
