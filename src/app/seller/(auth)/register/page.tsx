import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth, isAdminRole } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { StoreLink } from "@/components/seller/store-link";
import { ApplyWizard } from "@/components/seller/apply-wizard";
import { getApplication } from "@/server/seller/apply";
import { getBrandOptions, getCategoryOptions } from "@/server/seller/options";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Apply to sell", description: "Apply to sell on The Big Brands — 12% commission, weekly payouts, free-gift traffic." };

export default function SellerRegisterPage() {
  return (
    <>
      <div className="sa-top">
        <StoreLink href="/sell" className="sa-back">
          <Icon name="chevLeft" /> Why sell with us
        </StoreLink>
        <span>
          Already a seller? <SLink href="/seller/login">Sign in</SLink>
        </span>
      </div>
      <div className="sa-body wide">
        <div className="sa-h">
          <h1>Apply to sell</h1>
          <p>Four quick steps. We verify your GSTIN, PAN and bank details and usually approve within 2 working days.</p>
        </div>
        <Suspense fallback={<div className="sa-card" aria-busy="true" style={{ minHeight: 420 }} />}>
          <RegisterBody />
        </Suspense>
      </div>
    </>
  );
}

async function RegisterBody() {
  const [auth, categories, brands, href] = await Promise.all([getAuth(), getCategoryOptions(), getBrandOptions(), getSellerHref()]);
  const opts = { categories: categories.map((c) => ({ slug: c.slug, name: c.name })), brands: brands.map((b) => b.name) };
  if (!auth) return <ApplyWizard mode="new" {...opts} />;

  if (isAdminRole(auth.user.role)) {
    return (
      <div className="sa-alert sa-alert-warn">
        <Icon name="info" />
        <span>
          You&apos;re signed in as staff ({auth.user.email}). Seller accounts need their own email — sign out first, then apply.
        </span>
      </div>
    );
  }
  const app = await getApplication(auth.user.id);
  if (!app) return <ApplyWizard mode="upgrade" who={{ name: auth.user.name, email: auth.user.email, phone: auth.user.phone }} {...opts} />;
  if (app.status === "APPROVED") redirect(href("/seller"));
  if (app.status === "SUSPENDED") redirect(href("/seller/status"));
  return (
    <ApplyWizard
      mode="edit"
      who={{ name: auth.user.name, email: auth.user.email, phone: auth.user.phone }}
      rejectionReason={app.status === "REJECTED" ? app.rejectionReason : null}
      initial={{ ...app.form, state: app.form.state ?? "", upiId: app.form.upiId ?? "" }}
      {...opts}
    />
  );
}
