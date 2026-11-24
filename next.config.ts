import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  // seller.* and admin.* subdomains are routed in src/proxy.ts
  allowedDevOrigins: ["seller.localhost", "admin.localhost", "*.localhost"],
};

export default nextConfig;
