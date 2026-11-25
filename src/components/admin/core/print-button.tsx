"use client";
import { Icon } from "@/components/ui/icon";

export function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-dark btn-sm" onClick={() => window.print()}>
      <Icon name="upload" />
      {label}
    </button>
  );
}
