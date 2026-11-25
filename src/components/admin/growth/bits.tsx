/**
 * Small presentational pieces shared by the growth pages (server-compatible, no hooks).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/admin/ui";
import type { BrandLite } from "@/types/shared";
import { SlotSiteLink } from "./view-on-site";

// ── extra admin icons (download, alert, external link, rupee, refresh, pencil) ──
const EXTRA = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  bank: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>',
  id: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h5M14 14h3"/>',
} as const;
export type GIconName = keyof typeof EXTRA | IconName;

export function GIcon({ name, className, size }: { name: GIconName; className?: string; size?: number }) {
  if (name in EXTRA) {
    return (
      <svg
        className={className ? `ic ${className}` : "ic"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={size ? { width: size, height: size } : undefined}
        dangerouslySetInnerHTML={{ __html: EXTRA[name as keyof typeof EXTRA] }}
      />
    );
  }
  return <Icon name={name as IconName} className={className} size={size} />;
}

// ── delivery state pill ──
const TONE: Record<string, PillTone> = { live: "live", pending: "pending", info: "shipped", muted: "ended", crit: "rejected", warn: "packed" };
export function StatePill({ tone, label }: { tone: string; label: string }) {
  return <Pill tone={TONE[tone] ?? "ended"}>{label}</Pill>;
}

// ── slot code chip + name ──
export function SlotLine({ code, name, sub, href }: { code: string; name: string; sub?: string; href?: string }) {
  const body = (
    <>
      <b className="am-sid">{code}</b>
      <span>
        {name}
        {sub ? <small>{sub}</small> : null}
      </span>
    </>
  );
  return href ? (
    <Link className="am-slotc" href={href}>
      {body}
    </Link>
  ) : (
    <span className="am-slotc">{body}</span>
  );
}

// ── brand mark for campaign rows (house campaigns show the TBB mark) ──
type BrandMark = Pick<BrandLite, "name" | "word" | "sub" | "color" | "font" | "fontWeight" | "textTransform" | "letterSpacing" | "italic" | "logoUrl">;
export function CampaignMark({ brand, isHouse }: { brand: BrandMark | null; isHouse: boolean }) {
  if (isHouse || !brand) {
    return (
      <span className="ag-house" aria-label="The Big Brands">
        tbb<em>.</em>
      </span>
    );
  }
  return (
    <span className="am-cname-l">
      <BrandLogo brand={brand} size={13} showSub={false} />
    </span>
  );
}

export function CampaignName({
  href,
  brand,
  isHouse,
  title,
  sub,
}: {
  href: string;
  brand: BrandMark | null;
  isHouse: boolean;
  title: string;
  sub: ReactNode;
}) {
  return (
    <Link className="am-cname" href={href}>
      <CampaignMark brand={brand} isHouse={isHouse} />
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
    </Link>
  );
}

// ── CSV export menu (plain links → downloads) ──
export function ExportMenu({ items, label = "Export" }: { items: Array<{ href: string; label: string; sub?: string }>; label?: string }) {
  return (
    <details className="ag-menu">
      <summary className="btn btn-ghost btn-sm">
        <GIcon name="download" />
        {label}
      </summary>
      <div className="ag-menu-p" role="menu">
        {items.map((i) => (
          <a key={i.href} href={i.href} role="menuitem" download>
            <GIcon name="download" />
            <span>
              {i.label}
              {i.sub ? <small>{i.sub}</small> : null}
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}

// ── "Where it runs": mini wireframe of the storefront page with the slot lit up ──
const MAPS: Record<string, string[]> = {
  home: ["H1:hero", "H2:cards", "H4:tiles", "H3:strip", "H10:block", "H5:video", "H6:reels", "H8:halves", "H9:tiles", "H11:block", "H7:tiles"],
  search: ["S1:sugg", "S2:strip", "S3:cards", "S4:grid", "-:grid"],
  product: ["-:pdp", "P2:box", "P1:cards"],
  cart: ["-:list", "C1:cards", "-:list"],
  success: ["-:block", "C2:strip", "-:list"],
  brand: ["B1:hero", "-:cards", "-:grid"],
  offline: ["X1:flyer"],
};
const KIDS: Record<string, number> = { cards: 4, reels: 4, halves: 2, pdp: 2 };
const ord = (n: number) => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

export function placementOf(code: string, page: string): { rows: [string, string][]; pos: string } | null {
  const rows = (MAPS[page] ?? []).map((x) => x.split(":") as [string, string]);
  const idx = rows.findIndex((r) => r[0] === code);
  if (idx < 0) return null;
  const pos =
    page === "offline"
      ? "Printed insert in every delivery box"
      : rows[idx][1] === "sugg"
        ? "Inside the search-box suggestions"
        : idx === 0
          ? "Top of the page — the first thing shoppers see"
          : `${ord(idx + 1)} section from the top`;
  return { rows, pos };
}

export function WhereItRuns({
  code,
  name,
  page,
  pageLabel,
  format,
  rateLabel,
}: {
  code: string;
  name: string;
  page: string;
  pageLabel: string;
  format: string;
  rateLabel?: string;
}) {
  const p = placementOf(code, page);
  return (
    <div className="am-where">
      {p ? (
        <div className="am-map" aria-hidden="true">
          <i className="am-map-top" />
          {p.rows.map(([k, t], i) => (
            <i key={i} className={`am-map-${t}${k === code ? " on" : ""}`}>
              {Array.from({ length: KIDS[t] ?? 0 }, (_, j) => (
                <b key={j} />
              ))}
            </i>
          ))}
        </div>
      ) : null}
      <div className="am-where-t">
        <small>Where it runs</small>
        <b>
          <span className="am-sid">{code}</span>
          {name}
        </b>
        <span>
          {pageLabel} · {p ? p.pos : format}
        </span>
        <span>
          {format}
          {rateLabel ? ` · ${rateLabel}` : ""}
        </span>
      </div>
    </div>
  );
}

/** "View on site" link (opens the storefront page where the slot lives). */
export function ViewOnSite({ href, label = "View on site", aria }: { href: string | null; label?: string; aria?: string }) {
  if (!href) return <span className="am-muted am-viewl-x" title="Printed insert in every delivery box">In box</span>;
  return (
    <SlotSiteLink className="am-viewl" href={href} aria={aria}>
      {label}
      <GIcon name="ext" />
    </SlotSiteLink>
  );
}

/** "16 Nov – 14 Dec" (year shown only when it differs from the current one) */
export function flightLabel(a: string | Date, b: string | Date): string {
  const f = (d: string | Date) => {
    const x = new Date(d);
    const s = x.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    return x.getFullYear() !== new Date().getFullYear() ? `${s} ${x.getFullYear()}` : s;
  };
  return `${f(a)} – ${f(b)}`;
}

export function Note({ tone, icon = "info", children }: { tone?: "warn" | "crit" | "ok"; icon?: GIconName; children: ReactNode }) {
  return (
    <div className={tone ? `ag-note ag-note-${tone}` : "ag-note"}>
      <GIcon name={icon} />
      <div>{children}</div>
    </div>
  );
}
