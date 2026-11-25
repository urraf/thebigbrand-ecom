import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { ProductEditor } from "@/components/seller/product-editor";
import { getEditorOptions } from "@/server/seller/editor";
import { getSellerProduct } from "@/server/seller/products";

export const metadata: Metadata = { title: "Edit product" };

type Params = Promise<{ id: string }>;

export default function EditProductPage({ params }: { params: Params }) {
  return (
    <>
      <PageHead title="Edit product" back={{ href: "/seller/products", label: "Products" }} sub="Update details, photos, price and stock." />
      <Suspense fallback={<BodySkeleton rows={[260, 160, 220]} />}>
        <EditBody params={params} />
      </Suspense>
    </>
  );
}

async function EditBody({ params }: { params: Params }) {
  const { seller } = await requireSellerPage("/seller/products");
  const { id } = await params;
  const [product, opts] = await Promise.all([getSellerProduct(seller.id, id), getEditorOptions(seller)]);
  if (!product) notFound();
  if (product.status === "ARCHIVED") {
    return (
      <div className="sl-body">
        <div className="sl-card sl-empty">
          <Icon name="eyeOff" />
          <b>This product is archived</b>
          <p>Restore it from the products list to edit it. Restored products are re-checked before going live.</p>
          <SLink href="/seller/products?status=ARCHIVED" className="btn btn-dark">
            Go to archived products
          </SLink>
        </div>
      </div>
    );
  }
  return (
    <div className="sl-body">
      <ProductEditor
        initial={{
          id: product.id,
          slug: product.slug,
          status: product.status,
          rejectionReason: product.rejectionReason,
          name: product.name,
          brandId: product.brandId,
          categoryId: product.categoryId,
          size: product.size,
          sku: product.sku,
          mrp: product.mrp,
          price: product.price,
          stock: product.stock,
          description: product.description,
          howToUse: product.howToUse,
          ingredients: product.ingredients,
          bullets: product.bullets,
          concerns: product.concerns,
          tags: product.tags,
          images: product.images,
          art: product.art,
          hasOrders: product.hasOrders,
        }}
        {...opts}
      />
    </div>
  );
}
