import type { Metadata } from "next";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "@/components/catalog/results/results";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80);
  return {
    title: q ? `${q} — search results` : "Shop all beauty products",
    description: q ? `Shop ${q} from India's favourite beauty brands on The Big Brands — authentic products, honest prices and a free gift in every order.` : "Browse every beauty product on The Big Brands — filter by brand, concern, price and rating.",
    robots: q ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/s" },
  };
}

/** /s — search results & all-products listing (URL-driven: ?q&cat&brand&concern&min&max&rating&discount&gift&stock&sort&page). */
export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ResultsSkeleton mode="s" />}>
      <Results mode="s" searchParams={searchParams} />
    </Suspense>
  );
}
