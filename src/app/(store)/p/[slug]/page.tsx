import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductPage, ProductSkeleton, productTitle } from "@/components/catalog/product/pdp";
import { getProductDetail, listProductSlugs } from "@/server/catalog/product";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/product.css";

type Props = { params: Promise<{ slug: string }> };

/** Prerender every ACTIVE product (new ones render on first visit and are cached). */
export async function generateStaticParams() {
  const rows = await listProductSlugs();
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getProductDetail(slug);
  if (!d) return { title: "Product not found", robots: { index: false } };
  const title = productTitle(d);
  const description = (d.description ?? `Buy ${title} online at The Big Brands — 100% authentic, with a free TBB gift in every order.`).slice(0, 300);
  const img = d.images[0];
  return {
    title,
    description,
    alternates: { canonical: `/p/${d.card.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: img ? [{ url: img.url, width: img.width ?? undefined, height: img.height ?? undefined, alt: img.alt ?? title }] : undefined,
    },
    twitter: { card: img ? "summary_large_image" : "summary", title, description },
  };
}

/** /p/[slug] — product detail page (only ACTIVE products; anything else is a 404). */
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      {params.then(({ slug }) => (
        <ProductPage slug={slug} />
      ))}
    </Suspense>
  );
}
