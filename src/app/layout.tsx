import type { Metadata, Viewport } from "next";
import {
  Bebas_Neue,
  Bricolage_Grotesque,
  Caveat,
  DM_Serif_Display,
  Geist,
  Instrument_Serif,
  Syne,
} from "next/font/google";
import { site } from "@/lib/site";
import "@/styles/theme.css";

// Self-hosted fonts (no render-blocking Google Fonts request). Exposed as CSS variables used by theme.css
// and by brand wordmarks / ad creatives (Brand.font stores e.g. "var(--font-dmserif), serif").
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const dmserif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-dmserif", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3200"),
  title: { default: `${site.name} — Beauty marketplace`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_IN" },
};

export const viewport: Viewport = {
  themeColor: "#140a24",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontVars = [geist, bricolage, instrument, dmserif, bebas, syne, caveat].map((f) => f.variable).join(" ");
  return (
    <html lang="en-IN" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
