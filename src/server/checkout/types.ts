/**
 * Client-safe shapes returned by the commerce APIs (/api/v1/checkout, coupons, orders, account) and passed
 * from Server Components to the commerce client islands. Type-only module — no runtime code.
 */
import type { CartView, GiftOption, GiftTierLite } from "@/types/shared";

export type AppliedCoupon = {
  code: string;
  title: string;
  description: string | null;
  discount: number;
  brandName: string | null;
};

export type ChosenGift = { id: string; productId: string; miniName: string; miniSize: string; worth: number };

/** Every number the cart / checkout shows, recomputed on the server from DB prices. COD fee is separate. */
export type Quote = {
  count: number;
  mrpTotal: number;
  subtotal: number;
  /** savings vs M.R.P. (mrpTotal − subtotal) */
  productDiscount: number;
  coupon: AppliedCoupon | null;
  /** the cart carries a code that doesn't apply right now (shown with the reason; not counted) */
  couponIssue: { code: string; message: string } | null;
  couponDiscount: number;
  shippingFee: number;
  /** the standard delivery fee (struck through when delivery is free) */
  standardShippingFee: number;
  freeShippingMin: number;
  codEnabled: boolean;
  codFee: number;
  /** subtotal − coupon + delivery (add codFee for cash on delivery) */
  total: number;
  giftAllowance: number;
  nextTier: GiftTierLite | null;
  gifts: ChosenGift[];
  giftWorth: number;
  /** productDiscount + couponDiscount + giftWorth */
  savings: number;
};

export type CouponOffer = {
  code: string;
  title: string;
  description: string | null;
  brandName: string | null;
  applicable: boolean;
  discount: number;
  message: string;
  applied: boolean;
};

export type CartQuote = { cart: CartView; quote: Quote };

export type AddressView = {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type PaymentConfig = { mode: "RAZORPAY" | "TEST"; keyId: string | null; codEnabled: boolean; codFee: number };

export type CheckoutSummary = {
  cart: CartView;
  quote: Quote;
  gifts: GiftOption[];
  tiers: GiftTierLite[];
  addresses: AddressView[];
  payment: PaymentConfig;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
};

export type PlaceMethod = "UPI" | "CARD" | "NETBANKING" | "COD";

/** What the client needs after POST /api/v1/checkout/place (or a payment retry). */
export type PlaceResult = {
  order: { id: string; number: string; total: number; status: string };
  payment: {
    id: string;
    provider: "COD" | "TEST" | "RAZORPAY";
    amount: number;
    razorpay: {
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: "INR";
      name: string;
      description: string;
      prefill: { name?: string; email?: string; contact?: string; method?: string };
    } | null;
  };
  /** where to go next: the order page (COD / already paid) or the TEST gateway page */
  redirect: string | null;
  /** true when the idempotency key matched an order placed earlier (double click / retry) */
  reused: boolean;
};

export type OrderListItem = {
  number: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  placedAt: string | null;
  deliveredAt: string | null;
  itemCount: number;
  giftCount: number;
  thumbs: { name: string; imageUrl: string | null; c1: string | null; shape: string | null; c2: string | null; brandName: string }[];
};

export type OrderItemView = {
  id: string;
  productId: string;
  slug: string | null;
  name: string;
  brandName: string;
  size: string | null;
  imageUrl: string | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
  isOwnLabel: boolean;
  mrp: number;
  price: number;
  qty: number;
  lineTotal: number;
  status: string;
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  sellerName: string;
  returnable: boolean;
  returnRequested: boolean;
  returnBy: string | null;
};

export type OrderGiftView = {
  id: string;
  giftItemId: string;
  productId: string;
  name: string;
  miniSize: string;
  worth: number;
  imageUrl: string | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
};

export type OrderEventView = { id: string; status: string; note: string | null; actor: string | null; at: string };

export type OrderDetail = {
  id: string;
  number: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  mrpTotal: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  couponCode: string | null;
  giftWorth: number;
  savings: number;
  createdAt: string;
  placedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  eta: string | null;
  address: { name: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string };
  items: OrderItemView[];
  gifts: OrderGiftView[];
  events: OrderEventView[];
  payments: { id: string; provider: string; status: string; amount: number; providerPaymentId: string | null; at: string }[];
  canCancel: boolean;
  canPay: boolean;
  canReturn: boolean;
  /** the TEST gateway payment to resume (pending online order in test mode) */
  pendingPaymentId: string | null;
  refundNote: string | null;
};
