"use client";
import { useSyncExternalStore } from "react";
import { makeSellerHref, type SellerHref } from "./paths";

const noopSubscribe = () => () => {};
const clientHost = () => window.location.host;
const serverHost = () => null;
const clientProto = () => window.location.protocol;
const serverProto = () => "http:";

/**
 * Client hook: build portal links relative to the current host. During SSR/hydration it renders main-host
 * paths (/seller/…, which work on both hosts), then switches to bare paths on seller.* — useSyncExternalStore
 * makes that switch without a hydration mismatch.
 */
export function useSellerHref(): SellerHref {
  const host = useSyncExternalStore(noopSubscribe, clientHost, serverHost);
  const proto = useSyncExternalStore(noopSubscribe, clientProto, serverProto);
  return makeSellerHref(host, proto);
}
