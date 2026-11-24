/**
 * Shared, client-safe data shapes passed between server read functions, API responses and UI components.
 * These are the CONTRACT between feature areas — extend with optional fields only; don't rename.
 */

export type BrandLite = {
  id: string;
  slug: string;
  name: string;
  word: string | null;
  sub: string | null;
  color: string;
  accent: string | null;
  font: string | null;
  fontWeight: number;
  textTransform: string;
  letterSpacing: string;
  italic: boolean;
  isOwn: boolean;
  logoUrl: string | null;
};

export type ImageLite = { url: string; alt: string | null; width: number | null; height: number | null };

/** Fallback SVG packshot when a product has no photo (used for the client's own TBB label). */
export type PackshotArt = { shape: string | null; c1: string | null; c2: string | null; line?: string | null };

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  size: string | null;
  mrp: number;
  price: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  badge: string | null;
  stock: number;
  isOwnLabel: boolean;
  categorySlug: string;
  brand: BrandLite;
  image: ImageLite | null;
  art: PackshotArt;
};

export type AdTheme = { bg?: string; fg?: string; accent?: string };

/** An ad creative ready to render (returned by the ads serving layer). */
export type ServedAd = {
  id: string; // campaign id
  code: string; // campaign code, e.g. CMP-1042
  slotCode: string; // H1, H2 …
  isHouse: boolean; // The Big Brands' own promo → label "The Big Brands" instead of "Ad"
  brand: BrandLite | null;
  kicker: string | null;
  headline: string;
  subline: string | null;
  ctaLabel: string | null;
  linkUrl: string | null; // destination
  clickUrl: string; // tracked redirect: /api/v1/ads/click/<id>?to=<linkUrl>
  imageUrl: string | null;
  mobileImageUrl: string | null;
  videoUrl: string | null;
  theme: AdTheme | null;
  layout: string | null;
  products: ProductCardData[];
  targetKey: string | null;
  meta: Record<string, unknown>;
};

export type AdSlotInfo = {
  code: string;
  page: string;
  name: string;
  format: string;
  size: string;
  pricingModel: string;
  rate: number;
  rateLabel: string; // "₹4,000/day", "₹220 CPM"
  positions: number;
  potentialMonthly: number;
  isActive: boolean;
};

export type CartLine = {
  productId: string;
  qty: number;
  savedForLater: boolean;
  lineTotal: number;
  product: ProductCardData;
};

export type GiftOption = {
  id: string;
  productId: string;
  miniName: string;
  miniSize: string;
  worth: number;
  stock: number;
  product: ProductCardData;
};

export type GiftTierLite = { minAmount: number; giftCount: number };

export type CartView = {
  id: string;
  lines: CartLine[];
  saved: CartLine[];
  count: number; // Σ qty of active lines
  subtotal: number;
  mrpTotal: number;
  savings: number;
  shippingFee: number;
  giftAllowance: number;
  nextTier: GiftTierLite | null;
  giftIds: string[];
  couponCode: string | null;
};

export type SessionUser = {
  id: string;
  role: "CUSTOMER" | "SELLER" | "STAFF" | "ADMIN";
  name: string | null;
  email: string | null;
  phone: string | null;
};
