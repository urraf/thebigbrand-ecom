import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { gatewayMode } from "@/lib/payments";
import { Icon } from "@/components/ui/icon";
import { TestGateway } from "@/components/commerce/pay/test-gateway";
import { getTestPayment } from "@/server/payments/service";
import "@/styles/commerce/commerce.css";

export const metadata: Metadata = {
  title: "Test payment",
  robots: { index: false, follow: false },
};

/** /pay/test/:paymentId — the built-in TEST gateway page (owner only, TEST mode only). */
export default function TestPayPage({ params }: PageProps<"/pay/test/[paymentId]">) {
  return (
    <main className="pg-page">
      <Suspense fallback={<div className="pg-card cm-sk pg-sk" aria-busy="true" />}>
        <Loader params={params} />
      </Suspense>
      <p className="pg-brand">
        <Icon name="shield" /> TBB Test Gateway · for development and demos only
      </p>
    </main>
  );
}

async function Loader({ params }: { params: PageProps<"/pay/test/[paymentId]">["params"] }) {
  const { paymentId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/pay/test/${paymentId}`)}`);
  const p = await getTestPayment(auth.user.id, paymentId);
  if (!p) notFound();

  if (gatewayMode() !== "TEST") {
    return (
      <Msg title="Test gateway is off" icon="info">
        A live payment gateway is configured, so test payments are disabled. <Link href={`/order/${p.orderNumber}`}>Go to your order</Link> to pay securely.
      </Msg>
    );
  }
  if (p.status === "PAID") {
    return (
      <Msg title="Already paid" icon="check">
        {formatINR(p.amount)} for order {p.orderNumber} has been received. <Link href={`/order/${p.orderNumber}`}>View your order</Link>
      </Msg>
    );
  }
  if (p.status !== "PENDING" || p.orderStatus !== "PENDING_PAYMENT") {
    return (
      <Msg title="This payment has ended" icon="info">
        The payment window for order {p.orderNumber} is closed and nothing was charged. Your cart is saved — <Link href="/checkout">return to checkout</Link> to try again.
      </Msg>
    );
  }
  return <TestGateway p={p} />;
}

function Msg({ title, icon, children }: { title: string; icon: "check" | "info"; children: React.ReactNode }) {
  return (
    <div className="pg-card pg-msg">
      <span className={`pg-msg-ic is-${icon}`}>
        <Icon name={icon} />
      </span>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
