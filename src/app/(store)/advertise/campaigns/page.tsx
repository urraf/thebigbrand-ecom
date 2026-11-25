import type { Metadata } from "next";
import { MyCampaigns } from "@/components/ads/advertise/my-campaigns";
import "@/styles/ads/advertise.css";

export const metadata: Metadata = {
  title: "My ad campaigns",
  description: "Your campaigns on The Big Brands — review status, payments and live delivery.",
  robots: { index: false },
};

export default function MyCampaignsPage() {
  return (
    <div className="av avc">
      <div className="wrap">
        <MyCampaigns />
      </div>
    </div>
  );
}
