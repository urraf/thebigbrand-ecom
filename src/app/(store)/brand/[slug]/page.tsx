import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandBody, BrandHero } from "@/components/catalog/brands/store";
import { getCatalog } from "@/server/catalog/data";
import type { BrandStoreTab } from "@/server/catalog/brands";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const TABS: BrandStoreTab[] = ["all", "best", "new", "price"];

export async function generateStaticParams() {
  const { brands } = await getCatalog();
  return brands.filter((b) => b.productCount > 0).map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = (await getCatalog()).brands.find((x) => x.slug === slug);
  if (!b) return { title: "Brand not found", robots: { index: false } };
  return {
    title: `${b.displayName} — official store`,
    description: `${b.tagline ? `${b.tagline}. ` : ""}Shop ${b.productCount} ${b.displayName} products on The Big Brands — 100% authentic, sourced direct, with a free gift in every order.`,
    alternates: { canonical: `/brand/${b.slug}` },
    openGraph: b.bannerUrl ? { images: [{ url: b.bannerUrl }] } : undefined,
  };
}

/** /brand/[slug] — brand store (B1). The hero depends only on the slug (prerendered); the tabbed grid reads ?tab=. */
export default function BrandPage({ params, searchParams }: Props) {
  return (
    <div className="sr-page sr-brand">
      <div className="wrap">
        <Suspense fallback={<div className="ct-sk sr-sk-bh" />}>
          {params.then(({ slug }) => (
            <BrandHero slug={String(slug).toLowerCase()} />
          ))}
        </Suspense>
        <Suspense fallback={<div className="ct-sk sr-sk-bgrid" />}>
          {Promise.all([params, searchParams]).then(([{ slug }, sp]) => {
            const t = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
            const tab = TABS.includes(t as BrandStoreTab) ? (t as BrandStoreTab) : "all";
            return <BrandBody slug={String(slug).toLowerCase()} tab={tab} />;
          })}
        </Suspense>
      </div>
    </div>
  );
}
