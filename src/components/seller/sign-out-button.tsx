"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSellerHref } from "./use-seller-href";

export function SignOutButton({ className = "btn btn-ghost", label = "Sign out" }: { className?: string; label?: string }) {
  const router = useRouter();
  const href = useSellerHref();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/v1/auth/logout", { method: "POST", headers: { "x-tbb-scope": "seller" } }).catch(() => null);
        router.replace(href("/seller/login"));
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : label}
    </button>
  );
}
