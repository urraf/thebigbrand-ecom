import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { ForgotForm } from "@/components/seller/forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function SellerForgotPage() {
  return (
    <>
      <div className="sa-top">
        <SLink href="/seller/login" className="sa-back">
          <Icon name="chevLeft" /> Sign in
        </SLink>
        <span>
          New seller? <SLink href="/seller/register">Apply to sell</SLink>
        </span>
      </div>
      <div className="sa-body">
        <div className="sa-h">
          <h1>Reset your password</h1>
          <p>Enter your seller account email and we&apos;ll send a code to your registered mobile.</p>
        </div>
        <ForgotForm />
      </div>
    </>
  );
}
