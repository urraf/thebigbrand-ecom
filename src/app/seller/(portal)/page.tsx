import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { SalesChart } from "@/components/seller/sales-chart";
import { Thumb } from "@/components/seller/thumb";
import { ITEM_STATUS_LABEL, PAYOUT_LABEL, STATUS_TONE, fmtDay, fmtShort, inr, plural } from "@/components/seller/format";
import { getSellerDashboard } from "@/server/seller/dashboard";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Dashboard" };

export default function SellerDashboardPage() {
  return (
    <>
      <PageHead
        title="Dashboard"
        sub="Your store at a glance — sales, orders to ship and money owed to you."
        actions={
          <>
            <SLink href="/seller/orders?status=open" className="btn btn-ghost btn-sm">
              <Icon name="box" /> Orders to ship
            </SLink>
            <SLink href="/seller/products/new" className="btn btn-cart btn-sm">
              <Icon name="plus" /> Add product
            </SLink>
          </>
        }
      />
      <Suspense fallback={<BodySkeleton rows={[150, 340, 300]} />}>
        <DashboardBody />
      </Suspense>
    </>
  );
}

async function DashboardBody() {
  const { seller } = await requireSellerPage("/seller");
  const [d, href] = await Promise.all([getSellerDashboard(seller.id), getSellerHref()]);
  const delta = d.last30.deltaPct;
  const aov = d.last30.orders ? Math.round(d.last30.sales / d.last30.orders) : 0;
  const best = d.series.reduce((m, p) => (p.sales > m.sales ? p : m), d.series[0]);

  const attention: { tone: string; icon: "box" | "zap" | "truck" | "info" | "clock" | "layers" | "megaphone"; title: string; sub: string; href: string; cta: string }[] = [];
  if (d.toShip.placed) attention.push({ tone: "coral", icon: "zap", title: `${plural(d.toShip.placed, "new item")} to confirm`, sub: "Confirm within 24 hours to keep your dispatch score high", href: "/seller/orders?status=new", cta: "Confirm" });
  if (d.toShip.confirmed) attention.push({ tone: "violet", icon: "box", title: `${plural(d.toShip.confirmed, "item")} to pack`, sub: "Pack and print the slip", href: "/seller/orders?status=confirmed", cta: "Pack" });
  if (d.toShip.packed) attention.push({ tone: "gold", icon: "truck", title: `${plural(d.toShip.packed, "item")} ready to ship`, sub: "Add the courier and AWB number", href: "/seller/orders?status=packed", cta: "Ship" });
  if (d.products.rejected) attention.push({ tone: "crit", icon: "info", title: `${plural(d.products.rejected, "product")} rejected`, sub: "See the reason, fix and resubmit", href: "/seller/products?status=REJECTED", cta: "Fix" });
  if (d.products.pending) attention.push({ tone: "ok", icon: "clock", title: `${plural(d.products.pending, "product")} in review`, sub: "Usually approved within 24 working hours", href: "/seller/products?status=PENDING", cta: "View" });
  if (d.lowStock.length) attention.push({ tone: "gold", icon: "layers", title: `${plural(d.lowStock.length, "product")} low on stock`, sub: "10 units or fewer left", href: "/seller/inventory?lowStock=1", cta: "Restock" });
  if (d.ads.inReview) attention.push({ tone: "violet", icon: "megaphone", title: `${plural(d.ads.inReview, "campaign")} in review`, sub: "We review sponsored ads within 24 hours", href: "/seller/ads", cta: "View" });

  return (
    <div className="sl-body">
      <section className="sl-kpis" aria-label="Key numbers">
        <div className="sl-kpi sl-kpi-hero">
          <span className="sl-kpi-l">
            <Icon name="trending" /> Sales · last 30 days
          </span>
          <span className="sl-hero-v">{formatINR(d.last30.sales)}</span>
          <span className="sl-delta">
            {delta === null ? (
              <span>First 30 days of sales</span>
            ) : (
              <>
                <b className={delta < 0 ? "down" : undefined}>
                  <Icon name={delta < 0 ? "chevDown" : "trending"} />
                  {delta > 0 ? "+" : ""}
                  {delta}%
                </b>
                <span>vs previous 30 days ({formatINR(d.last30.prevSales)})</span>
              </>
            )}
          </span>
          <span className="sl-kpi-s">
            <b>{plural(d.last30.units, "unit")}</b> across <b>{plural(d.last30.orders, "order")}</b> · you earn <b>{formatINR(d.last30.earning)}</b> after commission
          </span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="clock" /> Sales today
          </span>
          <span className="sl-kpi-v">{formatINR(d.today.sales)}</span>
          <span className="sl-kpi-s">{d.today.units ? plural(d.today.units, "unit") + " sold so far" : "No orders yet today"}</span>
        </div>
        <Link href={href("/seller/orders?status=open")} className={d.toShip.total ? "sl-kpi sl-kpi-attn" : "sl-kpi"}>
          <span className="sl-kpi-l">
            <Icon name="box" /> Orders to ship
          </span>
          <span className="sl-kpi-v">{d.toShip.total}</span>
          <ul className="sl-mini sl-kpi-s">
            <li>
              <b>{d.toShip.placed}</b> new
            </li>
            <li>
              <b>{d.toShip.confirmed}</b> to pack
            </li>
            <li>
              <b>{d.toShip.packed}</b> to ship
            </li>
          </ul>
        </Link>
        <Link href={href("/seller/payouts")} className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="card" /> Balance
          </span>
          <span className="sl-kpi-v">{inr(d.balance.balance)}</span>
          <span className="sl-kpi-s">
            Next payout <b>{fmtDay(d.balance.nextPayoutAt)}</b>
            {d.balance.pendingEarnings ? (
              <>
                {" "}· {formatINR(d.balance.pendingEarnings)} on the way
              </>
            ) : null}
          </span>
        </Link>
        <Link href={href("/seller/products")} className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="bag" /> Live products
          </span>
          <span className="sl-kpi-v">{d.products.live}</span>
          <span className="sl-kpi-s">
            {d.products.pending ? <b>{d.products.pending} in review</b> : "None in review"}
            {d.products.rejected ? <> · {d.products.rejected} rejected</> : null}
          </span>
        </Link>
      </section>

      <div className="sl-grid">
        <section className="sl-card sl-span8" aria-labelledby="sl-sales-h">
          <div className="sl-card-h">
            <div>
              <h2 id="sl-sales-h">Daily sales</h2>
              <p>
                Last 30 days{best && best.sales > 0 ? (
                  <>
                    {" "}· best day <b>{fmtShort(`${best.date}T12:00:00+05:30`)}</b> with <b>{formatINR(best.sales)}</b>
                  </>
                ) : null}
              </p>
            </div>
            <SLink href="/seller/orders" className="link">
              All orders <Icon name="arrow" />
            </SLink>
          </div>
          <SalesChart data={d.series} />
          <dl className="sl-chart-foot">
            <div>
              <dt>Units sold</dt>
              <dd>{d.last30.units.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt>Avg. order value</dt>
              <dd>{formatINR(aov)}</dd>
            </div>
            <div>
              <dt>Your earnings</dt>
              <dd>{formatINR(d.last30.earning)}</dd>
            </div>
          </dl>
        </section>

        <section className="sl-card sl-span4" aria-labelledby="sl-att-h">
          <div className="sl-card-h">
            <div>
              <h2 id="sl-att-h">Needs your attention</h2>
              <p>{attention.length ? "Clear these to keep orders moving" : "Nothing waiting on you"}</p>
            </div>
          </div>
          {attention.length ? (
            <ul className="sl-att">
              {attention.map((a) => (
                <li key={a.title} className={`sl-att-${a.tone}`}>
                  <span className="sl-att-ic">
                    <Icon name={a.icon} />
                  </span>
                  <span className="sl-att-t">
                    <b>{a.title}</b>
                    <small>{a.sub}</small>
                  </span>
                  <Link href={href(a.href)} className="btn btn-ghost btn-sm">
                    {a.cta}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="sl-empty">
              <Icon name="check" />
              <b>All caught up</b>
              <p>New orders and review results will show up here.</p>
            </div>
          )}
        </section>
      </div>

      <div className="sl-grid">
        <section className="sl-card sl-span8" aria-labelledby="sl-recent-h">
          <div className="sl-card-h">
            <div>
              <h2 id="sl-recent-h">Recent orders</h2>
              <p>Only your items are shown — other sellers in the same order stay private.</p>
            </div>
            <SLink href="/seller/orders" className="link">
              View all <Icon name="arrow" />
            </SLink>
          </div>
          {d.recentOrders.length ? (
            <div className="sl-tscroll sl-tstack">
              <table className="sl-table sl-stack sl-stack-ord">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Items</th>
                    <th>Ship to</th>
                    <th className="r">You earn</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="sl-x-id">
                        <Link href={href(`/seller/orders/${o.number}`)} className="sl-oid">
                          {o.number}
                        </Link>
                        <span className="sl-sub">{fmtDay(o.placedAt)}</span>
                      </td>
                      <td className="sl-x-items" data-l="Items">
                        {o.items[0].name}
                        {o.items.length > 1 ? <span className="sl-sub">+ {o.items.length - 1} more</span> : <span className="sl-sub">Qty {o.items[0].qty}</span>}
                      </td>
                      <td className="sl-x-ship" data-l="Ship to">
                        {o.shipTo.city}
                        <span className="sl-sub">{o.shipTo.pincode}</span>
                      </td>
                      <td className="r num sl-x-amt" data-l="You earn">
                        {o.stage === "CANCELLED" ? (
                          <span className="sl-muted">—</span>
                        ) : (
                          <>
                            <b>{formatINR(o.earning)}</b>
                            <span className="sl-sub">of {formatINR(o.itemsTotal)}</span>
                          </>
                        )}
                      </td>
                      <td className="sl-x-st">
                        <Pill tone={STATUS_TONE[o.stage]}>{ITEM_STATUS_LABEL[o.stage]}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sl-empty">
              <Icon name="box" />
              <b>No orders yet</b>
              <p>Once your products are live, orders appear here the moment a shopper pays.</p>
            </div>
          )}
        </section>

        <div className="sl-span4" style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="sl-card" aria-labelledby="sl-low-h">
            <div className="sl-card-h">
              <div>
                <h2 id="sl-low-h">Low stock</h2>
                <p>Live products with 10 units or fewer</p>
              </div>
              <SLink href="/seller/inventory" className="link">
                Inventory <Icon name="arrow" />
              </SLink>
            </div>
            {d.lowStock.length ? (
              <ul className="sl-att">
                {d.lowStock.map((p) => (
                  <li key={p.id}>
                    <Thumb name={p.name} brand={p.brandName} image={p.image} art={p.art} size="sm" />
                    <span className="sl-att-t">
                      <b>{p.name}</b>
                      <small>
                        {p.brandName} · {formatINR(p.price)}
                      </small>
                    </span>
                    <span className={p.stock === 0 ? "sl-crit-t num" : "sl-warn-t num"}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sl-muted" style={{ fontSize: 13.5 }}>
                <Icon name="check" size={15} style={{ display: "inline", verticalAlign: -3, color: "var(--mint)" }} /> Every live product has healthy stock.
              </p>
            )}
          </section>
          <section className="sl-card" aria-labelledby="sl-pay-h">
            <div className="sl-card-h">
              <div>
                <h2 id="sl-pay-h">Payouts</h2>
                <p>Weekly, every Wednesday, to your bank account</p>
              </div>
              <SLink href="/seller/payouts" className="link">
                Ledger <Icon name="arrow" />
              </SLink>
            </div>
            <dl className="sl-kvs">
              <div className="sl-kv">
                <dt>Available</dt>
                <dd>
                  <b>{inr(d.balance.balance)}</b>
                </dd>
              </div>
              <div className="sl-kv">
                <dt>On the way</dt>
                <dd>
                  {formatINR(d.balance.pendingEarnings)} <span className="sl-muted">· {plural(d.balance.pendingItems, "item")} not yet delivered</span>
                </dd>
              </div>
              <div className="sl-kv">
                <dt>Last payout</dt>
                <dd>
                  {d.balance.lastPayout ? (
                    <>
                      {formatINR(d.balance.lastPayout.amount)} · {PAYOUT_LABEL[d.balance.lastPayout.status]}{" "}
                      <span className="sl-muted">{fmtShort(d.balance.lastPayout.paidAt ?? d.balance.lastPayout.createdAt)}</span>
                    </>
                  ) : (
                    "None yet"
                  )}
                </dd>
              </div>
              <div className="sl-kv">
                <dt>Paid to date</dt>
                <dd>{formatINR(d.balance.totalPaidOut)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
