import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth } from "@/lib/auth";
import { safeNext } from "@/components/commerce/next-path";
import { LoginClient } from "@/components/commerce/login/login-client";
import "@/styles/commerce/checkout.css";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to The Big Brands with your mobile number (OTP) or email to track orders and check out faster.",
};

/** /login?next=… — OTP-first sign-in. Already signed in → straight to `next`. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <Loader searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [sp, auth] = await Promise.all([searchParams, getAuth()]);
  const next = safeNext(sp.next);
  if (auth) redirect(next);
  return <LoginClient next={next} />;
}

function LoginSkeleton() {
  return (
    <section className="wrap cm-login" aria-busy="true">
      <div className="cm-login-card">
        <aside className="cm-login-art" aria-hidden="true" />
        <div className="cm-login-main">
          <div className="cm-sk cm-sk-title" />
          <div className="cm-sk cm-sk-block" />
        </div>
      </div>
    </section>
  );
}
