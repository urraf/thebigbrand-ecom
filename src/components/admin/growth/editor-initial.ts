import { isoDay } from "@/components/admin/ui/format";
import type { CampaignDetail } from "@/server/admin/growth/campaigns";
import type { EditorInitial } from "./campaign-editor";

/** CampaignDetail → editor form values (strings for inputs; dates as IST yyyy-mm-dd). */
export function editorInitialFrom(c: CampaignDetail): EditorInitial {
  return {
    id: c.id,
    code: c.code,
    status: c.status,
    name: c.name,
    slotCode: c.slot.code,
    advertiserId: c.advertiserId ?? "",
    brandId: c.brandId ?? "",
    isHouse: c.isHouse,
    kicker: c.kicker ?? "",
    headline: c.headline,
    subline: c.subline ?? "",
    ctaLabel: c.ctaLabel ?? "",
    linkUrl: c.linkUrl ?? "",
    imageUrl: c.imageUrl ?? "",
    mobileImageUrl: c.mobileImageUrl ?? "",
    videoUrl: c.videoUrl ?? "",
    themeBg: c.theme?.bg ?? "",
    themeFg: c.theme?.fg ?? "",
    themeAccent: c.theme?.accent ?? "",
    layout: c.layout ?? "",
    products: c.products,
    targetKey: c.targetKey ?? "",
    keywords: c.keywords,
    meta: Object.entries(c.meta ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)] as [string, string]),
    startDay: isoDay(c.startsAt),
    endDay: isoDay(c.endsAt),
    pricingModel: c.pricingModel,
    rate: c.rate,
    budget: c.budget,
    priority: c.priority,
    weight: c.weight,
    paymentStatus: c.paymentStatus,
  };
}
