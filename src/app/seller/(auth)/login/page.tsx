import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { LoginForm } from "@/components/seller/login-form";
import { StoreLink } from "@/components/seller/store-link";

export const metadata: Metadata = { title: "Sign in" };

export default function SellerLoginPage() {
  return (
    <>
      <div className="sa-top">
        <StoreLink href="/" className="sa-back">
          <Icon name="chevLeft" /> Back to store
        </StoreLink>
        <span>
          New seller? <SLink href="/seller/register">Apply to sell</SLink>
        </span>
      </div>
      <div className="sa-body">
        <div className="sa-h">
          <h1>Welcome back</h1>
          <p>Sign in to manage orders, products and payouts.</p>
        </div>
        <Suspense fallback={<div className="sa-form" aria-busy="true" style={{ minHeight: 260 }} />}>
          <LoginForm />
        </Suspense>
        <div className="sa-or">or</div>
        <p className="sa-alt">
          Not selling with us yet? <SLink href="/seller/register">Start your application</SLink> — it takes about 5 minutes.
        </p>
      </div>
    </>
  );
}
