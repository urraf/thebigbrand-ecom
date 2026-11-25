import type { Metadata } from "next";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "@/components/catalog/results/results";
import { getCatalog } from "@/server/catalog/data";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateStaticParams() {
  const { categories } = await getCatalog();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCatalog()).categories.find((x) => x.slug === slug);
  if (!c) return { title: "Category not found", robots: { index: false } };
  return {
    title: `${c.name} — shop ${c.productCount} products`,
    description: c.description ?? `Shop ${c.name.toLowerCase()} from India's favourite brands on The Big Brands — authentic, honest prices, and a free gift in every order.`,
    alternates: { canonical: `/c/${c.slug}` },
    openGraph: c.imageUrl ? { images: [{ url: c.imageUrl }] } : undefined,
  };
}

/** /c/[slug] — category listing: header with concern chips + brands, then the same results/filters as search. */
export default function CategoryPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<ResultsSkeleton mode="c" />}>
      {params.then(({ slug }) => (
        <Results mode="c" cat={String(slug).toLowerCase()} searchParams={searchParams} />
      ))}
    </Suspense>
  );
}
