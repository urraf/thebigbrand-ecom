"use client";
import type { ReactNode } from "react";
import { avEmit, type AvAct } from "./shared";

/** A button that drives the estimator / booking form / section nav from anywhere on the page. */
export function AvButton({ act, className, children, label }: { act: AvAct; className?: string; children: ReactNode; label?: string }) {
  return (
    <button type="button" className={className} aria-label={label} onClick={() => avEmit(act)}>
      {children}
    </button>
  );
}
