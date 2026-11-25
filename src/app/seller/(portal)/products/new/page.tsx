import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { ProductEditor } from "@/components/seller/product-editor";
import { getEditorOptions } from "@/server/seller/editor";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return (
    <>
      <PageHead title="Add a product" back={{ href: "/seller/products", label: "Products" }} sub="Fill in the details shoppers need. We check every listing for authenticity before it goes live." />
      <Suspense fallback={<BodySkeleton rows={[260, 160, 220]} />}>
        <NewBody />
      </Suspense>
    </>
  );
}

async function NewBody() {
  const { seller } = await requireSellerPage("/seller/products/new");
  const opts = await getEditorOptions(seller);
  return (
    <div className="sl-body">
      <ProductEditor initial={null} {...opts} />
    </div>
  );
}
