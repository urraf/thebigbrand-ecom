import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { flatParams, PageHeader, SkeletonPage, type SearchParamsInput } from "@/components/admin/ui";
import { CampaignEditor, type EditorInitial } from "@/components/admin/growth/campaign-editor";
import { isoDay } from "@/components/admin/ui/format";
import { editorOptions, newCampaignDefaults } from "@/server/admin/growth/campaigns";
import "@/styles/admin/growth.css";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="New campaign" back={{ href: "/admin/campaigns", label: "Campaigns" }} />
          <SkeletonPage stats={0} rows={10} />
        </>
      }
    >
      <NewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewContent({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/campaigns/new");
  const params = flatParams(await searchParams);
  const opts = await editorOptions();
  const house = params.house === "1";
  const slot = opts.slots.find((s) => s.code === (params.slot ?? "").toUpperCase()) ?? opts.slots.find((s) => s.code === (house ? "H1" : "H3")) ?? opts.slots[0];
  const adv = opts.advertisers.find((a) => a.id === params.advertiser);
  const d = newCampaignDefaults(slot);
  const initial: EditorInitial = {
    name: house ? `The Big Brands · ${slot.name}` : adv ? `${adv.name} · ${slot.name}` : "",
    slotCode: slot.code,
    advertiserId: adv?.id ?? "",
    brandId: adv?.brandId ?? "",
    isHouse: house,
    kicker: house ? "Only on The Big Brands" : "",
    headline: "",
    subline: "",
    ctaLabel: "Shop now",
    linkUrl: house ? "/gifts" : "",
    imageUrl: "",
    mobileImageUrl: "",
    videoUrl: "",
    themeBg: house ? "linear-gradient(120deg,#ff3d6e 0%,#ff6a4d 55%,#ffb347 100%)" : "",
    themeFg: house ? "#ffffff" : "",
    themeAccent: "",
    layout: slot.code === "H1" ? "split" : "",
    products: [],
    targetKey: "",
    keywords: [],
    meta: [],
    startDay: isoDay(d.startsAt),
    endDay: isoDay(d.endsAt),
    pricingModel: d.pricingModel,
    rate: d.rate,
    budget: 0,
    priority: house ? 0 : 10,
    weight: 1,
    paymentStatus: house ? "WAIVED" : "UNPAID",
  };
  return (
    <>
      <PageHeader
        back={{ href: "/admin/campaigns", label: "Campaigns" }}
        title={house ? "New house campaign" : "New campaign"}
        sub={
          house
            ? "Promote your own offers (free gifts, TBB Originals, sales) in any slot — labelled “The Big Brands”, billed ₹0."
            : "Book a slot for a brand directly (offline deal). Save as a draft, or approve to put it live."
        }
      />
      <CampaignEditor mode="create" initial={initial} options={opts} />
    </>
  );
}
