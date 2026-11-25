"use client";
import type { AnchorHTMLAttributes } from "react";
import { useSellerHref } from "./use-seller-href";

/** Link to a main-store page (e.g. "/", "/sell") — absolute URL when we're on the seller.* host. */
export function StoreLink({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const h = useSellerHref();
  return <a href={h.store(href)} {...rest} />;
}
