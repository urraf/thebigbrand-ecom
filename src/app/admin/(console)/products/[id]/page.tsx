import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { getProductForEdit, productFormOptions } from "@/server/admin/core/products";
import { ProductForm, type ProductFormValues } from "@/components/admin/core/product-form";
import { ConfirmButton, PageHeader, SkeletonTable, StatusPill, fmtDateTime } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Edit product" };

async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/products/${id}`);
  const [p, options, sp] = await Promise.all([getProductForEdit(id), productFormOptions(), searchParams]);
  if (!p) notFound();
  const initial: ProductFormValues = {
    name: p.name,
    slug: p.slug,
    brandId: p.brandId,
    categoryId: p.categoryId,
    sellerId: p.sellerId ?? "",
    sku: p.sku ?? "",
    size: p.size ?? "",
    mrp: p.mrp,
    price: p.price,
    stock: p.stock,
    status: p.status,
    badge: p.badge ?? "",
    description: p.description ?? "",
    howToUse: p.howToUse ?? "",
    ingredients: p.ingredients ?? "",
    bullets: p.bullets.join("\n"),
    concerns: p.concerns,
    tags: p.tags,
    shape: p.shape ?? "bottle",
    colorPrimary: p.colorPrimary ?? "",
    colorSecondary: p.colorSecondary ?? "",
    line: p.line,
    isFeatured: p.isFeatured,
    isOwnLabel: p.isOwnLabel,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    rejectionReason: p.rejectionReason ?? "",
  };
  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={p.name}
        badge={<StatusPill kind="product" status={p.status} />}
        sub={
          <span className="am-pmeta">
            <span>
              Sold by <b>{p.seller?.displayName ?? "The Big Brands Retail"}</b>
            </span>
            <span>
              <b>{p.soldCount.toLocaleString("en-IN")}</b> sold · <b>{p._count.orderItems}</b> order lines
            </span>
            <span>
              Rating <b>{p.rating.toFixed(1)}</b> ({p.reviewCount.toLocaleString("en-IN")})
            </span>
            {p.giftItem ? <span>Free-gift mini: <b>{p.giftItem.miniName}</b></span> : null}
            <span>Updated {fmtDateTime(p.updatedAt)}</span>
          </span>
        }
        actions={
          p.status !== "ARCHIVED" ? (
            <ConfirmButton
              url={`/api/v1/admin/products/${p.id}`}
              method="DELETE"
              className="btn btn-ghost btn-sm"
              confirm="Archive this product?"
              message="It disappears from the store and search. Past orders keep their details. You can restore it by setting the status back to Active."
              confirmLabel="Archive"
              tone="danger"
              success="Product archived"
              icon="trash"
            >
              <Icon name="trash" />
              Archive
            </ConfirmButton>
          ) : null
        }
      />
      {sp.created ? (
        <div className="am-allgood" role="status">
          <Icon name="check" />
          Product created{p.status === "ACTIVE" ? " and live on the store" : " — set the status to Active when it's ready to sell"}.
        </div>
      ) : null}
      {p.status === "REJECTED" && p.rejectionReason ? (
        <div className="am-ferrbox" role="status">
          <Icon name="info" />
          <span>Rejected: {p.rejectionReason}</span>
        </div>
      ) : null}
      <ProductForm id={p.id} initial={initial} options={options} storeSlug={p.slug} key={p.updatedAt} />
    </>
  );
}

export default function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader back={{ href: "/admin/products", label: "Products" }} title="Edit product" sub="Loading…" />
          <SkeletonTable rows={10} />
        </>
      }
    >
      <EditProduct params={params} searchParams={searchParams} />
    </Suspense>
  );
}
