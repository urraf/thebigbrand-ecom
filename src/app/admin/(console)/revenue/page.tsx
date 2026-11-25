import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { flatParams, PageHeader, SkeletonPage, type SearchParamsInput } from "@/components/admin/ui";
import { ExportMenu } from "@/components/admin/growth/bits";
import { ChartTips } from "@/components/admin/growth/chart-tips";
import {
  AdvertiserCard,
  DailyRevenueCard,
  DeliveryCard,
  ModelCard,
  RevenueKpis,
  SellerCard,
  SlotRevenueCard,
  TopCampaignsCard,
} from "@/components/admin/growth/revenue-view";
import { getRevenueReport, parseRange, REVENUE_RANGES } from "@/server/admin/growth/revenue";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "Revenue" };

export default function RevenuePage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Revenue" sub="Ad revenue, product sales and seller commission" />
          <SkeletonPage stats={4} rows={10} />
        </>
      }
    >
      <RevenueContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RevenueContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/revenue");
  const params = flatParams(await searchParams);
  const days = parseRange(params.days);
  const r = await getRevenueReport(days);
  const exp = (type: string) => `/api/v1/admin/revenue/export?days=${days}&type=${type}`;

  return (
    <>
      <PageHeader
        title="Revenue"
        sub={`Ad revenue, product sales and seller commission · ${r.start === r.end ? r.end : `${fmt(r.start)} – ${fmt(r.end)}`}`}
        actions={
          <>
            <nav className="am-segctl" aria-label="Date range">
              {REVENUE_RANGES.map((d) => (
                <Link key={d} href={d === 30 ? "/admin/revenue" : `/admin/revenue?days=${d}`} aria-current={d === days ? "true" : undefined} scroll={false}>
                  {d} days
                </Link>
              ))}
            </nav>
            <ExportMenu
              items={[
                { href: exp("daily"), label: "Daily revenue", sub: "Ad revenue, sales, orders, delivery" },
                { href: exp("slots"), label: "By ad slot", sub: "Revenue, CTR, eCPM, fill rate" },
                { href: exp("advertisers"), label: "By advertiser" },
                { href: exp("campaigns"), label: "By campaign" },
                { href: exp("sellers"), label: "Seller GMV & commission" },
              ]}
            />
          </>
        }
      />
      <RevenueKpis r={r} />
      <DailyRevenueCard r={r} />
      <div className="am-grid">
        <div className="am-span8">
          <SlotRevenueCard r={r} />
        </div>
        <div className="am-span4 ag-stack">
          <ModelCard r={r} />
          <AdvertiserCard r={r} />
        </div>
        <div className="am-span6">
          <DeliveryCard r={r} />
        </div>
        <div className="am-span6">
          <TopCampaignsCard r={r} />
        </div>
        <div className="am-span12">
          <SellerCard r={r} />
        </div>
      </div>
      <ChartTips />
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmt(key: string) {
  return `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
}
