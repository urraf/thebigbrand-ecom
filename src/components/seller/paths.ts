/**
 * Host-aware links for the seller portal (client-safe, pure).
 *
 * The portal is served on BOTH hosts:
 *   main store   http://localhost:3200/seller/orders        (thebigbrands.co.in/seller/orders)
 *   seller host  http://seller.localhost:3200/orders        (seller.thebigbrands.co.in/orders)
 * src/proxy.ts rewrites seller.<root>/* → /seller/*. Routes are written with the /seller prefix everywhere;
 * these helpers drop it on the seller host. Use:
 *   - Server Components: `const href = await getSellerHref()` (src/server/seller/host.ts, reads the Host header)
 *   - Client Components: `const href = useSellerHref()` (./use-seller-href.ts)
 */

export function isSellerHost(host: string | null | undefined): boolean {
  return /^seller\./i.test(String(host ?? "").trim());
}

/** "/seller/orders?x=1" → "/orders?x=1" on the seller host; unchanged on the main host. */
export function sellerPath(path: string, onSellerHost: boolean): string {
  if (!onSellerHost) return path;
  if (path === "/seller") return "/";
  if (/^\/seller[/?#]/.test(path)) {
    const rest = path.slice(7);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return path;
}

/** A main-store page (e.g. /sell, /p/slug) — absolute when we are on the seller host. */
export function storePath(path: string, host: string | null | undefined, protocol = "http:"): string {
  if (!isSellerHost(host)) return path;
  return `${protocol}//${String(host).replace(/^seller\./i, "")}${path}`;
}

export type SellerHref = ((path: string) => string) & { onSellerHost: boolean; store: (path: string) => string };

export function makeSellerHref(host: string | null | undefined, protocol = "http:"): SellerHref {
  const on = isSellerHost(host);
  const fn = ((path: string) => sellerPath(path, on)) as SellerHref;
  fn.onSellerHost = on;
  fn.store = (path: string) => storePath(path, host, protocol);
  return fn;
}

/** Only allow same-site relative redirects after login (?next=/seller/orders). */
export function safeNext(next: string | null | undefined, fallback = "/seller"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
