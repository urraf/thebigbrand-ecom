import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { CouponListQuery, couponStats, listCoupons, type CouponState } from "@/server/admin/core/coupons";
import { CouponEditor } from "@/components/admin/core/coupon-editor";
import { ApiSwitch, Card, DataTable, EmptyState, FilterChips, PageHeader, Pagination, Pill, SkeletonPage, StatCard, StatGrid, Toolbar, fmtDate, flatParams, type PillTone, type SearchParamsInput } from "@/components/admin/ui";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata = { title: "Coupons" };

const STATE: Record<CouponState, [string, PillTone]> = {
  live: ["Live", "live"],
  scheduled: ["Scheduled", "confirmed"],
  expired: ["Expired", "ended"],
  off: ["Off", "ended"],
  used_up: ["Used up", "pending"],
};

async function Coupons({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/coupons");
  const params = flatParams(await searchParams);
  const parsed = CouponListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : CouponListQuery.parse({});
  const [list, s, brands] = await Promise.all([listCoupons(q), couponStats(), db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  return (
    <>
      <StatGrid label="Coupon summary">
        <StatCard label="Live coupons" value={s.live} sub="Usable at checkout right now" href="/admin/coupons?status=live" />
        <StatCard label="Sponsored (H9 wall)" value={s.sponsored} sub={`${s.clips.toLocaleString("en-IN")} clips by shoppers`} href="/admin/coupons?kind=sponsored" />
        <StatCard label="Times used" value={s.uses.toLocaleString("en-IN")} sub="Orders with a coupon" />
        <StatCard label="Discount given" value={formatINR(s.discount)} sub="All time" />
      </StatGrid>
      <Card title="Coupons" sub="Store-wide codes and brand-sponsored coupons shown on the homepage coupon wall." actions={<CouponEditor trigger="new" brands={brands} />} id="am-coupons">
        <FilterChips
          basePath="/admin/coupons"
          params={params}
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "All" },
            { value: "live", label: "Live" },
            { value: "scheduled", label: "Scheduled" },
            { value: "expired", label: "Expired" },
            { value: "off", label: "Switched off" },
          ]}
        />
        <Toolbar
          search={{ placeholder: "Code, title or brand…" }}
          filters={[
            { param: "kind", label: "Kind", allLabel: "All coupons", options: [{ value: "store", label: "Store coupons" }, { value: "sponsored", label: "Sponsored brand coupons" }] },
            { param: "type", label: "Type", allLabel: "Any type", options: [{ value: "FLAT", label: "Flat ₹ off" }, { value: "PERCENT", label: "Percent off" }, { value: "BOGO", label: "Buy one get one" }] },
          ]}
        />
        <DataTable
          rows={list.items}
          rowKey={(c) => c.id}
          rowClassName={(c) => (c.state === "off" || c.state === "expired" ? "is-off" : undefined)}
          minWidth={960}
          empty={<EmptyState icon="percent" title="No coupons match" />}
          columns={[
            {
              key: "code",
              label: "Coupon",
              main: true,
              render: (c) => (
                <div className="am-cpn">
                  <span className="am-cpn-code">{c.code}</span>
                  <span>
                    <b>
                      {c.title}
                      {c.isSponsored ? <span className="am-tag am-tag-pz">Sponsored · H9</span> : null}
                    </b>
                    <small>{c.description ?? (c.minOrder ? `on orders of ${formatINR(c.minOrder)}+` : "on any order")}</small>
                  </span>
                </div>
              ),
            },
            {
              key: "deal",
              label: "Discount",
              render: (c) => (
                <span className="am-cpn-deal">
                  <b>{c.type === "PERCENT" ? `${c.value}% off` : c.type === "FLAT" ? `${formatINR(c.value)} off` : "BOGO"}</b>
                  <small className="am-sub">
                    {c.minOrder ? `min ${formatINR(c.minOrder)}` : "no minimum"}
                    {c.maxDiscount ? ` · cap ${formatINR(c.maxDiscount)}` : ""}
                  </small>
                </span>
              ),
            },
            { key: "brand", label: "Applies to", render: (c) => (c.brand ? <BrandLogo brand={c.brand} size={12} showSub={false} /> : <span className="am-muted">All products</span>) },
            {
              key: "when",
              label: "Valid",
              render: (c) => (
                <span className="nowrap am-cpn-when">
                  {c.startsAt ? fmtDate(c.startsAt) : "Now"} → {c.endsAt ? fmtDate(c.endsAt) : "no end"}
                </span>
              ),
            },
            {
              key: "use",
              label: "Usage",
              align: "right",
              render: (c) => (
                <>
                  <b className="num">
                    {c.usedCount}
                    {c.usageLimit ? <span className="am-muted"> / {c.usageLimit}</span> : null}
                  </b>
                  <small className="am-sub">
                    {c.isSponsored ? `${c.clipCount} clips · ` : ""}
                    {formatINR(c.discountGiven)} off
                  </small>
                </>
              ),
            },
            { key: "st", label: "Status", className: "am-keep", render: (c) => <Pill tone={STATE[c.state][1]}>{STATE[c.state][0]}</Pill> },
            {
              key: "act",
              label: "",
              align: "right",
              actions: true,
              className: "am-keep",
              render: (c) => (
                <span className="am-rowact">
                  <ApiSwitch checked={c.isActive} url={`/api/v1/admin/coupons/${c.id}`} field="isActive" label={`${c.code} active`} successOn={`${c.code} switched on`} successOff={`${c.code} switched off`} />
                  <CouponEditor trigger="edit" coupon={c} brands={brands} />
                </span>
              ),
            },
          ]}
        />
        <Pagination basePath="/admin/coupons" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="coupons" />
      </Card>
    </>
  );
}

export default function CouponsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Coupons" sub="Discount codes, limits and the sponsored brand coupons on the homepage wall." />
      <Suspense fallback={<SkeletonPage />}>
        <Coupons searchParams={searchParams} />
      </Suspense>
    </>
  );
}
