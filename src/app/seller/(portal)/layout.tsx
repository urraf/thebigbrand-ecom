import type { Metadata } from "next";
import { Suspense } from "react";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NavProgress } from "@/components/ui/nav-progress";
import { Toaster } from "@/components/ui/toast";
import { SellerShell, SellerShellLive } from "@/components/seller/shell";
import { getSellerNavCounts } from "@/server/seller/dashboard";
import "@/styles/store/ui.css";
import "@/styles/seller/portal.css";

export const metadata: Metadata = {
  title: { default: "Seller Central", template: "%s · Seller Central · The Big Brands" },
  robots: { index: false, follow: false },
};

/** Per-user sidebar data (session + badges) streams in; the frame itself is static. */
async function ShellData() {
  const auth = await getAuth("seller");
  const seller = auth
    ? await db.seller.findUnique({ where: { userId: auth.user.id }, select: { id: true, displayName: true, logoUrl: true, status: true, slug: true, contactName: true } })
    : null;
  const counts = seller?.status === "APPROVED" ? await getSellerNavCounts(seller.id) : null;
  return <SellerShellLive seller={seller ? { displayName: seller.displayName, logoUrl: seller.logoUrl, status: seller.status, slug: seller.slug, contactName: seller.contactName } : null} counts={counts} />;
}

export default function SellerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sl">
      <Suspense fallback={null}>
        <NavProgress tone="violet" />
      </Suspense>
      <Suspense fallback={<SellerShell seller={null} counts={null} active={null} />}>
        <ShellData />
      </Suspense>
      <main className="sl-main" id="main">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
