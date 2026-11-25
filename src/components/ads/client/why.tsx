"use client";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";

const DEFAULT =
  "Brands pay to show this here — it's always labelled. It's matched to the page you're on, never to your personal data. Every order still comes with your free TBB gift.";

/** "Why am I seeing this?" — explains an ad placement (toast). */
export function WhyButton({ label = "Why am I seeing this?", message = DEFAULT, house = false, className = "zn-why" }: { label?: string; message?: string; house?: boolean; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => toast(house ? "This is a promotion from The Big Brands itself — no brand paid for it." : message, { icon: "info", duration: 6000, action: { href: "/advertise", label: "Ad info" } })}
    >
      <Icon name="info" />
      {label}
    </button>
  );
}
