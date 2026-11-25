import type { CSSProperties } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactINR, formatINR } from "@/lib/money";
import { getDashboard } from "@/server/admin/core/dashboard";
import { RevenueChart } from "@/components/admin/core/revenue-chart";
import { CustomerCell, GiftChips } from "@/components/admin/core/bits";
import { Card, DataTable, Delta, EmptyState, KpiCard, PageHeader, SkeletonStats, SkeletonTable, StatusPill, fmtAgo, flatParams, pct, type SearchParamsInput } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata = { title: "Dashboard" };

function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const change = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

async function Dashboard({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const auth = await requireAdminPage("/admin");
  const params = flatParams(await searchParams);
  const d = await getDashboard();
  const now = new Date(d.now);
  const k = d.kpis;
  const totalMtd = k.salesMtd + k.adMtd;
  const totalPrev = k.salesPrevPeriod + k.adPrevPeriod;
  const firstName = (auth.user.name || "").split(" ")[0] || "there";
  const pendingTotal = d.pending.approvals + d.pending.campaigns + d.pending.sellers;
  const monthName = now.toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const topMax = Math.max(1, ...d.topProducts.map((p) => p.revenue));

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        sub={`${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })} · here's how the store and your ad business are doing`}
        actions={
          <>
            <Link className="btn btn-ghost btn-sm" href="/admin/orders?status=PLACED">
              <Icon name="box" />
              New orders
            </Link>
            <Link className="btn btn-dark btn-sm" href="/admin/products/new">
              <Icon name="plus" />
              Add product
            </Link>
          </>
        }
      />
      {params.denied ? (
        <div className="am-ferrbox" role="status">
          <Icon name="shield" />
          <span>Settings and the audit log are only available to the store owner (Admin role).</span>
        </div>
      ) : null}

      <section className="am-kpis" aria-label="Key numbers">
        <KpiCard
          hero
          label={`Total revenue · ${monthName} so far`}
          value={compactINR(totalMtd)}
          delta={<Delta value={change(totalMtd, totalPrev)} suffix="%" label={`vs the same days of last month (${compactINR(totalPrev)})`} />}
        >
          <div
            className="am-seg"
            role="img"
            aria-label={`Product sales ${formatINR(k.salesMtd)} (${pct(totalMtd ? k.salesMtd / totalMtd : 0)}), ad revenue ${formatINR(k.adMtd)} (${pct(totalMtd ? k.adMtd / totalMtd : 0)})`}
          >
            {k.salesMtd > 0 ? <i className="s" style={{ flex: k.salesMtd }} /> : null}
            {k.adMtd > 0 ? <i className="a" style={{ flex: k.adMtd }} /> : null}
            {totalMtd === 0 ? <i style={{ flex: 1, background: "var(--am-grid)" }} /> : null}
          </div>
          <ul className="am-seg-lg">
            <li>
              <i className="s" />
              Product sales <b>{compactINR(k.salesMtd)}</b>
            </li>
            <li>
              <i className="a" />
              Ad revenue <b>{compactINR(k.adMtd)}</b>
            </li>
          </ul>
        </KpiCard>
        <KpiCard
          label="Ad revenue this month"
          value={compactINR(k.adMtd)}
          delta={<Delta value={change(k.adMtd, k.adPrevPeriod)} suffix="%" label={k.adPrevPeriod ? "vs the same days of last month" : "first month of ad sales"} />}
          sub={
            <>
              <b>{compactINR(k.adToday)}</b> today · {k.liveCampaigns} campaign{k.liveCampaigns === 1 ? "" : "s"} live
            </>
          }
          href="/admin/revenue"
        />
        <KpiCard
          label="Orders today"
          value={k.ordersToday.toLocaleString("en-IN")}
          delta={<Delta value={k.ordersYesterday ? k.ordersToday - k.ordersYesterday : null} label={k.ordersYesterday ? "vs yesterday" : `${k.ordersYesterday} yesterday`} />}
          sub={
            <>
              <b>{formatINR(k.salesToday)}</b> sales today · AOV <b>{formatINR(k.aovMtd)}</b> this month
            </>
          }
          href="/admin/orders"
        />
        <KpiCard
          label="Gift → full-size conversion"
          value={k.giftConversion.gifted ? pct(k.giftConversion.rate, 1) : "—"}
          sub={
            k.giftConversion.gifted
              ? `${k.giftConversion.converted} of ${k.giftConversion.gifted} customers bought the full size after trying its free mini`
              : "Shows once customers receive free TBB minis"
          }
          href="/admin/gifts"
        />
        <article className="am-kpi">
          <div className="am-kpi-l">Waiting for approval</div>
          <div className="am-kpi-v">{pendingTotal}</div>
          <div className="am-kpi-split">
            <Link href="/admin/approvals" className={d.pending.approvals ? "hot" : undefined}>
              <b>{d.pending.approvals}</b>Products
            </Link>
            <Link href="/admin/campaigns" className={d.pending.campaigns ? "hot" : undefined}>
              <b>{d.pending.campaigns}</b>Campaigns
            </Link>
            <Link href="/admin/sellers" className={d.pending.sellers ? "hot" : undefined}>
              <b>{d.pending.sellers}</b>Sellers
            </Link>
          </div>
          <small className="am-kpi-s">{pendingTotal ? "Tap a number to review" : "All caught up"}</small>
        </article>
      </section>

      <div className="am-grid">
        <section className="blk am-card am-span8" aria-labelledby="am-rev-h">
          <RevenueChart data={d.revenue} />
        </section>

        <Card className="am-span4" title="Needs your attention" sub={d.attention.length ? `${d.attention.length} item${d.attention.length > 1 ? "s" : ""}` : "Nothing urgent"} id="am-att">
          {d.attention.length ? (
            <ul className="am-att">
              {d.attention.map((a) => (
                <li key={a.key} className={`am-att-${a.tone}`}>
                  <span className="am-att-ic">
                    <Icon name={a.icon as IconName} />
                  </span>
                  <span className="am-att-t">
                    <b>{a.title}</b>
                    <small>{a.sub}</small>
                  </span>
                  <Link className="btn btn-ghost btn-sm" href={a.href}>
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="am-allgood">
              <Icon name="check" />
              All caught up — no approvals, new orders or stock alerts.
            </div>
          )}
        </Card>

        <Card
          className="am-span8"
          title="Recent orders"
          sub="Every order ships with the free TBB gifts the customer picked"
          id="am-ro"
          actions={
            <Link className="link" href="/admin/orders">
              All orders <Icon name="chevRight" />
            </Link>
          }
        >
          <DataTable
            small
            rows={d.recentOrders}
            rowKey={(o) => o.number}
            rowClassName={(o) => (o.status === "PLACED" ? "is-fresh" : undefined)}
            empty={<EmptyState icon="box" title="No orders yet" />}
            columns={[
              {
                key: "n",
                label: "Order",
                main: true,
                render: (o) => (
                  <>
                    <Link className="am-oid am-rowlink" href={`/admin/orders/${o.number}`}>
                      {o.number}
                    </Link>
                    {o.status === "PLACED" ? <> <span className="am-new">NEW</span></> : null}
                    <small className="am-sub">
                      {fmtAgo(o.placedAt, d.now)} · {o.items} item{o.items === 1 ? "" : "s"}
                    </small>
                  </>
                ),
              },
              { key: "c", label: "Customer", render: (o) => <CustomerCell name={o.customer} sub={o.city} /> },
              { key: "g", label: "Free gifts chosen", hideMobile: false, render: (o) => <GiftChips gifts={o.gifts} compact /> },
              { key: "t", label: "Amount", align: "right", render: (o) => <b className="num">{formatINR(o.total)}</b> },
              { key: "s", label: "Status", render: (o) => <StatusPill kind="order" status={o.status} /> },
            ]}
          />
        </Card>

        <div className="am-span4 am-col-stack">
          <Card title="Top products" sub="Revenue, last 30 days" id="am-top" actions={<Link className="link" href="/admin/products?sort=sold">Products <Icon name="chevRight" /></Link>}>
            {d.topProducts.length ? (
              <ol className="am-rank">
                {d.topProducts.map((p) => (
                  <li key={p.id} title={`${p.name} — ${p.units} sold, ${formatINR(p.revenue)}`}>
                    <span className="am-rank-n">
                      <span>
                        <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                      </span>
                    </span>
                    <span className="am-rank-bar">
                      <i style={{ "--p": (p.revenue / topMax).toFixed(3) } as CSSProperties} />
                      <em>
                        {compactINR(p.revenue)} · {p.units} sold
                      </em>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="am-muted am-pad">No sales in the last 30 days.</p>
            )}
          </Card>
          <Card
            title="Low stock"
            sub={d.outOfStock ? `${d.outOfStock} out of stock · ${d.lowStock.length} running low` : "10 units or fewer"}
            id="am-low"
            actions={<Link className="link" href="/admin/products?stock=low">Restock <Icon name="chevRight" /></Link>}
          >
            {d.lowStock.length ? (
              <ul className="am-ls">
                {d.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                    <span className={`am-ls-v${p.stock <= 5 ? " crit" : ""}`}>
                      <b>{p.stock}</b>left
                    </span>
                    <small>{p.brand}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="am-allgood">
                <Icon name="check" />
                Every live product has more than 10 units.
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function DashboardFallback() {
  return (
    <>
      <PageHeader title="Dashboard" sub="Loading today's numbers…" />
      <SkeletonStats n={5} />
      <div className="am-grid">
        <div className="am-span8">
          <SkeletonTable rows={6} />
        </div>
        <div className="am-span4">
          <SkeletonTable rows={4} />
        </div>
      </div>
    </>
  );
}

export default function DashboardPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
