/**
 * Server-side pieces of the campaigns pages: approval-queue card, "now live" hint, table columns, preview mapping.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { compactNumber, formatINR } from "@/lib/money";
import { fmtDate, fmtDay, Pill, pct, type Column } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";
import type { CampaignDetail, CampaignListItem } from "@/server/admin/growth/campaigns";
import type { BrandLite } from "@/types/shared";
import { CampaignName, GIcon, SlotLine, StatePill, WhereItRuns } from "./bits";
import { CampaignActions } from "./campaign-actions";
import { CreativePreview, type PreviewCreative } from "./creative-preview";
import { SlotSiteLink } from "./view-on-site";

export function toPreview(c: CampaignDetail): PreviewCreative {
  return {
    slotCode: c.slot.code,
    slotSize: c.slot.size,
    isHouse: c.isHouse,
    brand: (c.brand as BrandLite | null) ?? null,
    kicker: c.kicker ?? "",
    headline: c.headline,
    subline: c.subline ?? "",
    ctaLabel: c.ctaLabel ?? "",
    imageUrl: c.imageUrl ?? "",
    mobileImageUrl: c.mobileImageUrl ?? "",
    videoUrl: c.videoUrl ?? "",
    theme: c.theme ?? {},
    layout: c.layout ?? "",
    products: c.products,
    targetKey: c.targetKey ?? "",
    keywords: c.keywords,
    meta: c.meta ?? {},
  };
}

const PAY_TONE = { PAID: "live", INVOICED: "shipped", UNPAID: "pending", WAIVED: "ended" } as const;
export function PaymentPill({ status }: { status: string }) {
  const label = status === "PAID" ? "Paid" : status === "INVOICED" ? "Invoiced" : status === "WAIVED" ? "Waived" : "Unpaid";
  return <Pill tone={PAY_TONE[status as keyof typeof PAY_TONE] ?? "ended"}>{label}</Pill>;
}

export function QueueCard({ c, now }: { c: CampaignDetail; now: string }) {
  const perDay = c.days ? Math.round(c.bookedValue / c.days) : 0;
  const who = c.isHouse ? "The Big Brands (house)" : (c.advertiser?.name ?? c.sellerName ?? c.brand?.name ?? "Advertiser");
  return (
    <article className="blk am-camp">
      <div className="am-camp-prev">
        <small className="am-prev-l">
          <Icon name="eye" />
          Shopper preview · {c.slot.size}
        </small>
        <CreativePreview c={toPreview(c)} />
        <WhereItRuns code={c.slot.code} name={c.slot.name} page={c.slot.page} pageLabel={c.slot.pageLabel} format={c.slot.format} rateLabel={c.rateLabel} />
      </div>
      <div className="am-camp-info">
        <div className="am-camp-meta">
          <StatePill tone={c.tone} label={c.stateLabel} />
          <span>
            {c.code} · submitted {fmtDay(c.createdAt)}
            {c.sellerName ? ` · seller ${c.sellerName}` : ""}
          </span>
          <PaymentPill status={c.paymentStatus} />
        </div>
        <h3>
          <Link href={`/admin/campaigns/${c.id}`}>{who}</Link>
        </h3>
        <dl className="am-dl">
          <div>
            <dt>Ad slot</dt>
            <dd>
              <SlotLine code={c.slot.code} name={c.slot.name} sub={c.slot.pageLabel} />
            </dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>
              {fmtDay(c.startsAt)} → {fmtDay(c.endsAt)} <small>· {c.days} day{c.days === 1 ? "" : "s"}</small>
            </dd>
          </div>
          <div>
            <dt>{c.pricingModel === "DAY" || c.pricingModel === "WEEK" || c.pricingModel === "MONTH" ? "Booking value" : "Budget cap"}</dt>
            <dd>
              <b>{formatINR(c.bookedValue)}</b>
              {perDay ? <small>· {formatINR(perDay)}/day</small> : null}
            </dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{c.rateLabel}</dd>
          </div>
        </dl>
        <ul className="am-checks">
          <li>
            <Icon name="check" />
            Headline {c.headline.length} chars
          </li>
          {c.linkUrl ? (
            <li>
              <Icon name="check" />
              Links to {c.linkUrl.length > 28 ? c.linkUrl.slice(0, 28) + "…" : c.linkUrl}
            </li>
          ) : ["S3", "S4", "P1", "C1"].includes(c.slot.code) && c.products.length ? (
            <li>
              <Icon name="check" />
              Links to the product page
            </li>
          ) : (
            <li className="am-info">
              <GIcon name="alert" />
              No click-through link
            </li>
          )}
          {c.slot.isActive ? (
            <li>
              <Icon name="check" />
              Slot {c.slot.code} is live
            </li>
          ) : (
            <li className="am-warn">
              <GIcon name="alert" />
              Slot {c.slot.code} is paused — <Link href={`/admin/ads/${c.slot.code}`}>resume it</Link> to show this ad
            </li>
          )}
          {c.endsAt < now ? (
            <li className="am-warn">
              <GIcon name="alert" />
              Flight already ended — edit the dates first
            </li>
          ) : null}
          {c.paymentStatus === "UNPAID" && !c.isHouse ? (
            <li className="am-info">
              <GIcon name="alert" />
              Not paid yet
            </li>
          ) : null}
        </ul>
        <CampaignActions id={c.id} code={c.code} status={c.status} variant="queue" afterApprove={`/admin/campaigns?approved=${c.id}`} />
      </div>
    </article>
  );
}

export function ApprovedHint({ c }: { c: CampaignDetail }) {
  const live = c.state === "LIVE";
  const title = live
    ? `Now live in slot ${c.slot.code} on the ${c.slot.pageLabel}`
    : c.state === "SCHEDULED"
      ? `Approved — goes live on ${fmtDay(c.startsAt)}`
      : c.state === "SLOT_PAUSED"
        ? `Approved for slot ${c.slot.code} — resume the slot to show it`
        : `Approved · ${c.stateLabel}`;
  return (
    <div className={live ? "ag-hint" : "ag-hint is-warn"} role="status">
      <span className="ag-hint-ic">
        <Icon name="check" />
      </span>
      <div className="ag-hint-t">
        <b>{title}</b>
        <span>
          {c.isHouse ? "The Big Brands" : (c.brand?.name ?? c.advertiser?.name)} · “{c.headline}” {live ? `is showing in ${c.slot.name} for shoppers on the website & app.` : ""}{" "}
          {c.bookedValue ? `${formatINR(c.bookedValue)} booked.` : ""}
        </span>
      </div>
      {c.viewUrl ? (
        <SlotSiteLink className="btn btn-sm btn-light" href={c.viewUrl}>
          View on site
          <Icon name="arrow" />
        </SlotSiteLink>
      ) : null}
      <Link className="ib-sm" href="/admin/campaigns" aria-label="Dismiss" scroll={false}>
        <Icon name="close" />
      </Link>
    </div>
  );
}

export function campaignColumns(): Column<CampaignListItem>[] {
  return [
    {
      key: "c",
      label: "Campaign",
      main: true,
      render: (c) => (
        <CampaignName
          href={`/admin/campaigns/${c.id}`}
          brand={c.brand}
          isHouse={c.isHouse}
          title={c.headline}
          sub={`${c.isHouse ? "The Big Brands · house" : (c.advertiser?.name ?? c.sellerName ?? c.brand?.name ?? "—")} · ${c.code}`}
        />
      ),
    },
    { key: "s", label: "Slot", render: (c) => <SlotLine code={c.slot.code} name={c.slot.name} href={`/admin/ads/${c.slot.code}`} /> },
    {
      key: "st",
      label: "Status",
      render: (c) => (
        <span style={{ display: "grid", gap: 4, justifyItems: "start" }}>
          <StatePill tone={c.tone} label={c.stateLabel} />
          {!c.isHouse && c.paymentStatus !== "PAID" ? <small className="am-muted" style={{ fontSize: 11.5 }}>{c.paymentStatus === "UNPAID" ? "Unpaid" : c.paymentStatus === "INVOICED" ? "Invoiced" : "Waived"}</small> : null}
        </span>
      ),
    },
    {
      key: "d",
      label: "Flight",
      render: (c) => (
        <span className="nowrap" title={`${fmtDate(c.startsAt)} → ${fmtDate(c.endsAt)}`}>
          {fmtDate(c.startsAt).replace(/ \d{4}$/, "")} – {fmtDate(c.endsAt).replace(/ \d{4}$/, "")}
          <span className="ag-sub">
            {c.state === "LIVE" || c.state === "SLOT_PAUSED" || c.state === "BUDGET_SPENT" ? `Day ${c.elapsed}/${c.days}` : `${c.days} day${c.days === 1 ? "" : "s"}`}
          </span>
        </span>
      ),
    },
    {
      key: "b",
      label: "Booked",
      align: "right",
      render: (c) => (
        <span className="num">
          <b>{c.isHouse ? "House" : formatINR(c.bookedValue)}</b>
          <span className="ag-sub">{c.rateLabel}</span>
        </span>
      ),
    },
    {
      key: "sp",
      label: "Spent",
      render: (c) => {
        const cap = c.bookedValue || 0;
        const p = cap ? Math.min(1, c.spent / cap) : c.days ? c.elapsed / c.days : 0;
        return (
          <div className="am-fill" style={{ minWidth: 104 }}>
            <div className="am-meter am-meter-pz" style={{ "--p": Math.max(p, c.spent ? 0.02 : 0).toFixed(3), marginTop: 0 } as CSSProperties}>
              <i />
            </div>
            <span className="num">{c.isHouse ? "₹0" : formatINR(c.spent)}</span>
          </div>
        );
      },
    },
    {
      key: "r",
      label: "Results",
      align: "right",
      render: (c) =>
        c.impressions ? (
          <span className="num nowrap">
            <b>{compactNumber(c.impressions)}</b> impr.
            <span className="ag-sub">{pct(c.ctr, 2)} CTR</span>
          </span>
        ) : (
          <span className="am-muted">—</span>
        ),
    },
  ];
}
