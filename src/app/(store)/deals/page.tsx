import type { Metadata } from "next";
import { Suspense } from "react";
import { Results, ResultsSkeleton } from "@/components/catalog/results/results";
import "@/styles/catalog/catalog.css";
import "@/styles/catalog/search.css";

export const metadata: Metadata = {
  title: "Today's Deals — up to 50% off beauty",
  description: "Today's beauty deals on The Big Brands: 15% off and more on skincare, haircare, makeup and fragrance. New deals drop at midnight — and every order ships with a free gift.",
  alternates: { canonical: "/deals" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /deals — every product at ≥15% off, with the deals header + countdown and the same filters as search. */
export default function DealsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ResultsSkeleton mode="deals" />}>
      <Results mode="deals" searchParams={searchParams} />
    </Suspense>
  );
}
