import { notFound } from "next/navigation";

/** Any unknown storefront URL renders the store-styled 404 (src/app/(store)/not-found.tsx) with header + footer. */
export const instant = false; // a 404 can't be prerendered for instant navigation — opt out of validation

export default function Missing() {
  notFound();
}
