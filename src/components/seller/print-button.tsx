"use client";
import { Icon } from "@/components/ui/icon";

export function PrintButton({ label = "Print slip" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-cart btn-sm" onClick={() => window.print()}>
      <Icon name="layers" /> {label}
    </button>
  );
}
