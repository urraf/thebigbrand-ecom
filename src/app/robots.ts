import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** /robots.txt — keep crawlers out of the consoles, account, checkout and the API. */
export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/seller", "/account", "/checkout", "/cart", "/api", "/pay", "/order"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
