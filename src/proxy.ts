import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge of the app:
 * 1. Host routing — `seller.<ROOT_DOMAIN>` serves the seller portal (rewritten to /seller/*),
 *    `admin.<ROOT_DOMAIN>` serves the admin console (rewritten to /admin/*). The same pages also
 *    work on the main domain at /seller and /admin (useful locally and before DNS is set up).
 *    Locally: http://seller.localhost:3200 and http://admin.localhost:3200 work in Chrome.
 * 2. Light auth gate — redirects to the right login page when there is no valid session token.
 *    Pages and API routes still do full checks (session revocation, seller approval) server-side.
 */

const SESSION_COOKIE = "tbb_session";
const PUBLIC_SELLER_PATHS = ["/seller/login", "/seller/register", "/seller/status", "/seller/forgot"];
const PUBLIC_ADMIN_PATHS = ["/admin/login"];

async function roleFromToken(token: string | undefined): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function subdomainOf(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const root = (process.env.ROOT_DOMAIN ?? "localhost").split(":")[0].toLowerCase();
  if (hostname === root || hostname === `www.${root}`) return null;
  if (hostname.endsWith(`.${root}`)) return hostname.slice(0, -(root.length + 1));
  return null;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const sub = subdomainOf(req.headers.get("host") ?? "");
  let pathname = url.pathname;
  let rewritten = false;

  // 1) host routing
  // Store-only pages requested on seller.* (e.g. a "Sell on TBB" link) belong to the main storefront.
  const STORE_ONLY = /^\/(sell|p|s|c|cart|checkout|brand|brands|deals|gifts|account|advertise|order|credits|about|kit)(\/|$)/;
  if (sub === "seller" && STORE_ONLY.test(pathname)) {
    const rootHost = process.env.ROOT_DOMAIN ?? (req.headers.get("host") ?? "").replace(/^seller\./, "");
    // Raw Location header: NextResponse.redirect would shorten a "same-origin" URL to a relative path,
    // which the browser would resolve back onto seller.* — the host must stay explicit.
    const target = new URL(`${pathname}${req.nextUrl.search}`, `${req.nextUrl.protocol}//${rootHost}`).toString();
    return new NextResponse(null, { status: 307, headers: { Location: target } });
  }
  if (sub === "seller" && !pathname.startsWith("/seller")) {
    pathname = pathname === "/" ? "/seller" : `/seller${pathname}`;
    rewritten = true;
  } else if (sub === "admin" && !pathname.startsWith("/admin")) {
    pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    rewritten = true;
  }

  // 2) auth gate for console areas
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isSellerArea = pathname === "/seller" || pathname.startsWith("/seller/");
  const isAccountArea = pathname === "/account" || pathname.startsWith("/account/");

  if (isAdminArea && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const role = await roleFromToken(token);
    if (role !== "ADMIN" && role !== "STAFF") {
      const login = req.nextUrl.clone();
      login.pathname = sub === "admin" ? "/login" : "/admin/login";
      login.search = `?next=${encodeURIComponent(url.pathname)}`;
      return NextResponse.redirect(login);
    }
  }

  if (isSellerArea && !PUBLIC_SELLER_PATHS.some((p) => pathname.startsWith(p))) {
    const role = await roleFromToken(token);
    if (!role) {
      const login = req.nextUrl.clone();
      login.pathname = sub === "seller" ? "/login" : "/seller/login";
      login.search = `?next=${encodeURIComponent(url.pathname)}`;
      return NextResponse.redirect(login);
    }
  }

  if (isAccountArea && !(await roleFromToken(token))) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(url.pathname)}`;
    return NextResponse.redirect(login);
  }

  if (rewritten) {
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // skip API routes, Next internals and static files
  matcher: ["/((?!api|_next/static|_next/image|media|uploads|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|avif|svg|gif|ico|css|js|txt|woff2?)$).*)"],
};
