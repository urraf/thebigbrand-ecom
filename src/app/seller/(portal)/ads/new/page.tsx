import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { BookForm } from "@/components/seller/book-form";
import { promotableProducts } from "@/server/seller/ads";
import { getSellerSlots } from "@/server/seller/options";

export const metadata: Metadata = { title: "Promote a product" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function NewCampaignPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead title="Promote a product" back={{ href: "/seller/ads", label: "Sponsored ads" }} sub="Sponsored products are labelled “Sponsored” and appear where shoppers are already looking." />
      <Suspense fallback={<BodySkeleton rows={[200, 200, 200]} />}>
        <NewBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const ist = (offsetDays: number) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function NewBody({ searchParams }: { searchParams: SP }) {
  const { seller } = await requireSellerPage("/seller/ads/new");
  const sp = await searchParams;
  const [products, slots] = await Promise.all([promotableProducts(seller.id), getSellerSlots()]);
  const pre = Array.isArray(sp.product) ? sp.product[0] : sp.product;
  return (
    <div className="sl-body">
      <BookForm
        products={products.map((p) => ({ id: p.id, name: p.name, brand: p.brand.name, price: p.price, stock: p.stock, image: p.images[0] ?? null, art: { shape: p.shape, c1: p.colorPrimary, c2: p.colorSecondary } }))}
        slots={slots.map((s) => ({ code: s.code, name: s.name, rate: s.rate, isActive: s.isActive, pricingModel: s.pricingModel }))}
        minStart={ist(1)}
        defaultEnd={ist(14)}
        preselect={pre}
        prefill={{ name: seller.contactName, email: seller.email, contact: seller.phone }}
      />
    </div>
  );
}
