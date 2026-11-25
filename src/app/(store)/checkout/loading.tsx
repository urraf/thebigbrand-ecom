import { PageLoader } from "@/components/ui/page-loader";

/** Shown inside the store chrome while a page's server data streams in (header/footer stay put). */
export default function Loading() {
  return <PageLoader label="Preparing your checkout…" rows={6} />;
}
