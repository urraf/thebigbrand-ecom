/** Public, client-safe site constants. */
export const site = {
  name: "The Big Brands",
  domain: "thebigbrands.co.in",
  tagline: "A Shriram Ventures Initiative",
  description:
    "India's beauty marketplace — 50+ authentic brands, honest prices and a free gift you choose in every order.",
  supportEmail: "care@thebigbrands.co.in",
  adsEmail: "ads@thebigbrands.co.in",
  sellerEmail: "sellers@thebigbrands.co.in",
  supportPhone: "1800 120 4455",
  freeShippingMin: 499,
  shippingFee: 49,
  codFee: 0,
  currency: "INR",
} as const;

/** Cookie names (shared by server code, route handlers and proxy). */
export const COOKIES = {
  session: "tbb_session",
  cart: "tbb_cart",
  inspector: "tbb_inspect",
} as const;
