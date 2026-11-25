import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { compactNumber, formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { CampaignActions } from "@/components/seller/campaign-actions";
import { Thumb } from "@/components/seller/thumb";
import { CAMPAIGN_STATUS_LABEL, STATUS_TONE, fmtShort } from "@/components/seller/format";
import { listSellerCampaigns } from "@/server/seller/ads";
import { getSellerSlots } from "@/server/seller/options";

export const metadata: Metadata = { title: "Sponsored ads" };

export default function SellerAdsPage() {
  return (
    <>
      <PageHead
        title="Sponsored ads"
        sub="Put your products at the top of search results and on related product pages. Pay only for clicks."
        actions={
          <SLink href="/seller/ads/new" className="btn btn-cart btn-sm">
            <Icon name="megaphone" /> Promote a product
          </SLink>
        }
      />
      <Suspense fallback={<BodySkeleton rows={[120, 360]} />}>
        <AdsBody />
      </Suspense>
    </>
  );
}

async function AdsBody() {
  const { seller } = await requireSellerPage("/seller/ads");
  const [{ items, totals }, slots] = await Promise.all([listSellerCampaigns(seller.id), getSellerSlots()]);
  const prefill = { name: seller.contactName, email: seller.email, contact: seller.phone };
  const unpaid = items.filter((c) => c.paymentStatus === "UNPAID" && c.status === "PENDING_REVIEW").length;

  return (
    <div className="sl-body">
      <section className="sl-kpis" aria-label="Campaign totals" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="zap" /> Running now
          </span>
          <span className="sl-kpi-v">{totals.live}</span>
          <span className="sl-kpi-s">of {items.length} campaigns</span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="eye" /> Impressions
          </span>
          <span className="sl-kpi-v">{compactNumber(totals.impressions)}</span>
          <span className="sl-kpi-s">times your products were shown</span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="target" /> Clicks
          </span>
          <span className="sl-kpi-v">{totals.clicks.toLocaleString("en-IN")}</span>
          <span className="sl-kpi-s">{totals.ctr}% click-through rate</span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="card" /> Spend
          </span>
          <span className="sl-kpi-v">{formatINR(totals.spent)}</span>
          <span className="sl-kpi-s">{totals.clicks ? `${formatINR(Math.round((totals.spent / totals.clicks) * 100) / 100, { decimals: true })} per click` : "excl. GST"}</span>
        </div>
      </section>

      {unpaid ? (
        <div className="sl-note sl-note-warn">
          <Icon name="card" />
          <span>
            <b>{unpaid === 1 ? "1 campaign is" : `${unpaid} campaigns are`} waiting for payment.</b> We start the review as soon as it&apos;s paid.
          </span>
        </div>
      ) : null}

      <section className="sl-card" aria-labelledby="camp-h">
        <div className="sl-card-h">
          <div>
            <h2 id="camp-h">Your campaigns</h2>
            <p>
              {slots.map((s) => `${s.code} ${s.name} · ${formatINR(s.rate)}/click${s.isActive ? "" : " (paused)"}`).join("  ·  ")}
            </p>
          </div>
        </div>
        {items.length ? (
          <div className="sl-tscroll sl-tstack">
            <table className="sl-table sl-stack">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Placement</th>
                  <th>Dates</th>
                  <th>Budget used</th>
                  <th className="r">Performance</th>
                  <th>Status</th>
                  <th className="r">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const ended = c.ended;
                  const used = c.budget ? Math.min(1, c.spent / c.budget) : 0;
                  return (
                    <tr key={c.id}>
                      <td className="sl-x-full">
                        <div className="sl-prod" style={{ minWidth: 200 }}>
                          {c.product ? <Thumb name={c.product.name} brand="" image={c.product.image} art={c.product.art} /> : null}
                          <span>
                            <b>{c.product?.name ?? c.name}</b>
                            <small>
                              {c.code}
                              {c.keywords.length ? ` · ${c.keywords.slice(0, 3).join(", ")}${c.keywords.length > 3 ? "…" : ""}` : ""}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td data-l="Placement">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="sl-sid">{c.slotCode}</span>
                          <span className="nowrap">{c.slotName}</span>
                        </span>
                      </td>
                      <td data-l="Dates" className="nowrap">
                        {fmtShort(c.startsAt)} – {fmtShort(c.endsAt)}
                      </td>
                      <td data-l="Budget used" style={{ minWidth: 140 }}>
                        <span className="num">
                          {formatINR(c.spent)} <span className="sl-muted">of {formatINR(c.budget)}</span>
                        </span>
                        <span className="sl-meter" style={{ ["--p" as string]: used, marginTop: 6 }}>
                          <i />
                        </span>
                      </td>
                      <td className="r num nowrap" data-l="Performance">
                        {compactNumber(c.impressions)} views · {c.clicks.toLocaleString("en-IN")} clicks
                        <span className="sl-sub">{c.ctr}% CTR</span>
                      </td>
                      <td data-l="Status">
                        {c.live ? <Pill tone="ok">Live</Pill> : <Pill tone={ended && c.status === "APPROVED" ? "off" : STATUS_TONE[c.status]}>{ended && c.status === "APPROVED" ? "Ended" : CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</Pill>}
                        <span className="sl-sub" style={c.status === "REJECTED" ? { color: "var(--sl-crit-t)", maxWidth: 220 } : undefined}>
                          {c.status === "REJECTED" && c.rejectionReason ? c.rejectionReason : c.paymentStatus === "PAID" ? "Paid" : c.paymentStatus === "UNPAID" ? "Payment due" : c.paymentStatus.toLowerCase()}
                          {c.pausedBySeller ? " · paused by you" : ""}
                        </span>
                      </td>
                      <td className="r sl-x-full">
                        <CampaignActions id={c.id} code={c.code} status={c.status} paymentStatus={c.paymentStatus} pausedBySeller={c.pausedBySeller} ended={ended} prefill={prefill} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sl-empty">
            <Icon name="megaphone" />
            <b>Get your products seen first</b>
            <p>Sponsored products show at the top of search results and on related product pages. Set a budget, pay per click, pause any time.</p>
            <SLink href="/seller/ads/new" className="btn btn-cart">
              <Icon name="megaphone" /> Promote a product
            </SLink>
          </div>
        )}
      </section>
    </div>
  );
}
