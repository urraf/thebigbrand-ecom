"use client";
/**
 * "View on site" for an ad slot: opens the storefront page in a new tab with the "Show ad slots" overlay switched
 * on (the store inspector reads the shared `tbb_inspect` cookie / localStorage flag), so every placement is
 * outlined with its code, size and rate.
 */
import type { ReactNode } from "react";

function inspectorOn() {
  try {
    localStorage.setItem("tbb_inspect", "1");
  } catch {
    /* storage blocked */
  }
  document.cookie = `tbb_inspect=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function SlotSiteLink({ href, className, children, aria }: { href: string; className?: string; children: ReactNode; aria?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener" aria-label={aria} onClick={inspectorOn} title="Opens the page with “Show ad slots” on">
      {children}
    </a>
  );
}
