import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

/** What the "Show ad slots" inspector prints on a placement. */
export type SlotInfo = { code: string; name: string; size?: string | null; rateLabel?: string | null };

type PzSlotProps = {
  slot: SlotInfo;
  as?: ElementType;
  className?: string;
  children: ReactNode;
  [attr: string]: unknown;
};

/**
 * Placement-zone wrapper for any paid placement: `.pz-slot[data-slot]` + the inspector tag.
 * Ad-blocker safe naming (pz-*, never "ad"/"sponsor"/"banner"). Shared component.
 */
export function PzSlot({ slot, as: Tag = "div", className, children, ...rest }: PzSlotProps) {
  return (
    <Tag className={cx("pz-slot", className)} data-slot={slot.code} {...rest}>
      {children}
      <SlotTag slot={slot} />
    </Tag>
  );
}

/** The inspector label on its own (for placements that render their own wrapper element). */
export function SlotTag({ slot }: { slot: SlotInfo }) {
  const meta = [slot.size, slot.rateLabel].filter(Boolean).join(" · ");
  return (
    <span className="slot-tag pz-tag" aria-hidden="true">
      <b>{slot.code}</b>
      {slot.name}
      {meta ? <i>{meta}</i> : null}
    </span>
  );
}

/** "Ad" badge (house placements pass label="The Big Brands"). */
export function PzBadge({ label = "Ad", className }: { label?: string; className?: string }) {
  return <span className={cx("pz-badge", className)}>{label}</span>;
}
