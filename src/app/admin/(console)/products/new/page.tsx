import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { productFormOptions } from "@/server/admin/core/products";
import { ProductForm } from "@/components/admin/core/product-form";
import { PageHeader, SkeletonTable } from "@/components/admin/ui";

export const metadata = { title: "Add product" };

async function NewProduct() {
  await requireAdminPage("/admin/products/new");
  const options = await productFormOptions();
  return <ProductForm options={options} />;
}

export default function NewProductPage() {
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="Add product" sub="Sold by The Big Brands Retail unless you pick a seller. Save as Draft to finish later." />
      <Suspense fallback={<SkeletonTable rows={10} />}>
        <NewProduct />
      </Suspense>
    </>
  );
}
