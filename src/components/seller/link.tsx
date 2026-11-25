"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useSellerHref } from "./use-seller-href";

/** next/link for portal routes: pass "/seller/…" — renders the bare path on the seller.* host. */
export function SLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const h = useSellerHref();
  return <Link href={h(href)} {...rest} />;
}
