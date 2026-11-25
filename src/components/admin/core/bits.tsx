/** Small presentational pieces shared by admin-core pages (server-compatible). */
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { avatarTint, initials } from "@/components/admin/ui/format";

export function CustomerCell({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <div className="am-cust">
      <span className="am-cav" style={{ background: avatarTint(name) }} aria-hidden="true">
        {initials(name)}
      </span>
      <span>
        <b>{name}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}

const HEX = /^#[0-9a-f]{3,6}$/i;

export function GiftChips({ gifts, compact }: { gifts: Array<{ name: string; c1?: string | null }>; compact?: boolean }) {
  if (!gifts.length) return <span className="am-muted">—</span>;
  return (
    <div className="am-gchips">
      {gifts.map((g, i) => (
        <span className="am-gchip" key={g.name + i} title={g.name}>
          <span className="am-gchip-art am-gchip-ic" style={{ "--tint": g.c1 && HEX.test(g.c1) ? g.c1 : "#ff3d6e" } as CSSProperties}>
            <Icon name="gift" />
          </span>
          {compact ? g.name.split(" ").slice(0, 2).join(" ") : g.name}
        </span>
      ))}
    </div>
  );
}

export const PAYMENT_LABEL: Record<string, string> = { RAZORPAY: "Prepaid · Razorpay", COD: "Cash on delivery", TEST: "Prepaid · test gateway" };
export const PAYMENT_SHORT: Record<string, string> = { RAZORPAY: "Prepaid", COD: "COD", TEST: "Prepaid (test)" };
