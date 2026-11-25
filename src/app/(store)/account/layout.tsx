import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountNav } from "@/components/commerce/account/account-nav";
import "@/styles/commerce/checkout.css";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s · Your account · The Big Brands" },
  robots: { index: false, follow: false },
};

/** Account shell: section nav + content. Sign-in is enforced by the proxy and again by every page. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap cm-acc">
      <Suspense fallback={<nav className="cm-acc-nav" aria-label="Your account" />}>
        <AccountNav />
      </Suspense>
      <div className="cm-acc-main">{children}</div>
    </div>
  );
}
