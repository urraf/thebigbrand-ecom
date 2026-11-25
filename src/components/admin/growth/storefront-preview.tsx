/**
 * The saved creative rendered by the storefront's own zone components (owned by the ads area), exactly as
 * shoppers see it in its slot. Links and buttons are disabled (`inert`) so admins never record clicks.
 * Formats without a standalone zone renderer (H7 brand tiles, H9 coupon wall, S1 suggestions, B1, X1) return null —
 * the editor's live preview covers them.
 */
import type { ReactNode } from "react";
import { BuyBoxZone, NativeTileZone, PresentedByZone, SearchHeadlineZone, SponsoredRailZone, ThankYouZone } from "@/components/ads/commerce";
import { DealZone, DoubleBillboardZone, HeroZone, LeaderboardZone, ReelsZone, ShelfZone, SpotlightZone, VideoZone } from "@/components/ads/home";
import { getZoneSlot } from "@/server/ads/slots";
import type { CampaignDetail } from "@/server/admin/growth/campaigns";
import type { BrandLite, ServedAd } from "@/types/shared";
import "@/styles/ads/zones.css";

export const STOREFRONT_RENDERED = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "H8", "H10", "H11", "S2", "S3", "S4", "P1", "P2", "C1", "C2"]);

function toServed(c: CampaignDetail): ServedAd {
  return {
    id: c.id,
    code: c.code,
    slotCode: c.slot.code,
    isHouse: c.isHouse,
    brand: (c.brand as BrandLite | null) ?? null,
    kicker: c.kicker,
    headline: c.headline,
    subline: c.subline,
    ctaLabel: c.ctaLabel,
    linkUrl: c.linkUrl,
    clickUrl: c.linkUrl && c.linkUrl.startsWith("/") ? c.linkUrl : "/",
    imageUrl: c.imageUrl,
    mobileImageUrl: c.mobileImageUrl,
    videoUrl: c.videoUrl,
    theme: c.theme,
    layout: c.layout,
    products: c.products,
    targetKey: c.targetKey,
    meta: { ...(c.meta ?? {}) },
  };
}

export async function StorefrontPreview({ c }: { c: CampaignDetail }) {
  const code = c.slot.code;
  if (!STOREFRONT_RENDERED.has(code)) return null;
  const slot = await getZoneSlot(code);
  if (!slot) return null;
  const ad = toServed(c);
  const needsProducts = ["S3", "P1", "C1", "S4", "H10", "H11"].includes(code);
  if (needsProducts && !c.products.length) return <p className="am-muted" style={{ fontSize: 13 }}>Add at least one product to see this format on the storefront.</p>;
  if (code === "H4" && !ad.brand) return <p className="am-muted" style={{ fontSize: 13 }}>Pick a brand to see the “Presented by” chip.</p>;

  let zone: ReactNode = null;
  switch (code) {
    case "H1":
      zone = <HeroZone ads={[ad]} slot={slot} />;
      break;
    case "H2":
      zone = <SpotlightZone ads={[ad]} slot={slot} />;
      break;
    case "H3":
      zone = <LeaderboardZone ad={ad} slot={slot} />;
      break;
    case "H4":
      zone = <PresentedByZone ad={ad} slot={slot} />;
      break;
    case "H5":
      zone = <VideoZone ad={ad} slot={slot} />;
      break;
    case "H6":
      zone = <ReelsZone ads={[ad]} slot={slot} />;
      break;
    case "H8":
      zone = <DoubleBillboardZone ads={[ad]} slot={slot} />;
      break;
    case "H10":
      zone = <DealZone ad={ad} slot={slot} />;
      break;
    case "H11":
      zone = <ShelfZone ad={ad} slot={slot} />;
      break;
    case "S2":
      zone = <SearchHeadlineZone ad={ad} slot={slot} />;
      break;
    case "S4":
      zone = <NativeTileZone ad={ad} slot={slot} />;
      break;
    case "S3":
    case "P1":
    case "C1":
      zone = <SponsoredRailZone ads={[ad]} slot={slot} layout="grid" />;
      break;
    case "P2":
      zone = <BuyBoxZone ad={ad} slot={slot} />;
      break;
    case "C2":
      zone = <ThankYouZone ad={ad} slot={slot} />;
      break;
  }
  return (
    <div className="ag-store" inert>
      {zone}
    </div>
  );
}
