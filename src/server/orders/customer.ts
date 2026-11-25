import "server-only";
import { z } from "zod";
import { db, type OrderStatus, type Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { formatINR } from "@/lib/money";
import { gatewayMode } from "@/lib/payments";
import { cancelOrder } from "./cancel";
import type { OrderDetail, OrderListItem } from "@/server/checkout/types";

/**
 * CUSTOMER ORDERS — "Your orders" list, order detail / confirmation, customer cancel and return requests.
 * Every read is scoped to the signed-in user's id (customers only ever see their own orders).
 */

export const RETURN_WINDOW_DAYS = 7;
const CANCELLABLE_ITEM = ["PLACED", "CONFIRMED", "PACKED"];

export const ORDER_FILTERS = {
  all: null,
  active: ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"],
  unpaid: ["PENDING_PAYMENT"],
  delivered: ["DELIVERED"],
  returns: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
  cancelled: ["CANCELLED"],
} as const satisfies Record<string, readonly OrderStatus[] | null>;
export type OrderFilter = keyof typeof ORDER_FILTERS;

export const orderListQuery = z.object({
  status: z.enum(Object.keys(ORDER_FILTERS) as [OrderFilter, ...OrderFilter[]]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Estimated delivery: 3 days after placement, skipping Sundays. */
export function etaFrom(placed: Date): Date {
  const d = new Date(placed);
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d;
}

export async function listOrders(userId: string, q: z.infer<typeof orderListQuery>) {
  const statuses = ORDER_FILTERS[q.status];
  const where: Prisma.OrderWhereInput = { userId, ...(statuses ? { status: { in: [...statuses] } } : {}) };
  const [rows, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        number: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        placedAt: true,
        deliveredAt: true,
        _count: { select: { gifts: true } },
        items: {
          select: { name: true, qty: true, imageUrl: true, brandName: true, product: { select: { colorPrimary: true, colorSecondary: true, shape: true } } },
        },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);
  const items: OrderListItem[] = rows.map((o) => ({
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    placedAt: o.placedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    itemCount: o.items.reduce((a, i) => a + i.qty, 0),
    giftCount: o._count.gifts,
    thumbs: o.items.slice(0, 4).map((i) => ({ name: i.name, imageUrl: i.imageUrl, brandName: i.brandName, c1: i.product.colorPrimary, c2: i.product.colorSecondary, shape: i.product.shape })),
  }));
  const byStatus = new Map(counts.map((c) => [c.status, c._count._all]));
  const filterCounts = Object.fromEntries(
    (Object.keys(ORDER_FILTERS) as OrderFilter[]).map((k) => {
      const s = ORDER_FILTERS[k];
      return [k, s ? s.reduce((a, st) => a + (byStatus.get(st) ?? 0), 0) : counts.reduce((a, c) => a + c._count._all, 0)];
    }),
  ) as Record<OrderFilter, number>;
  return { ...paged(items, total, q.page, q.limit), counts: filterCounts };
}

/** Items a customer already asked to return (from the audit trail). */
async function requestedReturnItemIds(orderId: string): Promise<Set<string>> {
  const logs = await db.auditLog.findMany({ where: { entity: "Order", entityId: orderId, action: "order.return_requested" }, select: { data: true } });
  const ids = new Set<string>();
  for (const l of logs) {
    const d = l.data as { itemIds?: unknown } | null;
    if (Array.isArray(d?.itemIds)) for (const id of d.itemIds) if (typeof id === "string") ids.add(id);
  }
  return ids;
}

const detailSelect = {
  id: true,
  number: true,
  userId: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  mrpTotal: true,
  subtotal: true,
  discount: true,
  shippingFee: true,
  codFee: true,
  total: true,
  couponCode: true,
  createdAt: true,
  placedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  shipName: true,
  shipPhone: true,
  shipLine1: true,
  shipLine2: true,
  shipLandmark: true,
  shipCity: true,
  shipState: true,
  shipPincode: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      name: true,
      brandName: true,
      size: true,
      imageUrl: true,
      mrp: true,
      price: true,
      qty: true,
      lineTotal: true,
      status: true,
      courier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
      seller: { select: { displayName: true } },
      product: { select: { slug: true, shape: true, colorPrimary: true, colorSecondary: true, isOwnLabel: true } },
    },
  },
  gifts: {
    select: {
      id: true,
      giftItemId: true,
      name: true,
      miniSize: true,
      worth: true,
      giftItem: { select: { productId: true, product: { select: { shape: true, colorPrimary: true, colorSecondary: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } } } },
    },
  },
  events: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, note: true, actor: true, createdAt: true } },
  payments: { orderBy: { createdAt: "asc" }, select: { id: true, provider: true, status: true, amount: true, providerPaymentId: true, createdAt: true } },
} satisfies Prisma.OrderSelect;

export async function getOrderDetail(userId: string, number: string): Promise<OrderDetail | null> {
  const o = await db.order.findFirst({ where: { number, userId }, select: detailSelect });
  if (!o) return null;
  const requested = await requestedReturnItemIds(o.id);
  const now = Date.now();
  const mode = gatewayMode();

  const live = o.items.filter((i) => i.status !== "CANCELLED");
  const canCancel = o.status === "PENDING_PAYMENT" || (["PLACED", "CONFIRMED", "PACKED"].includes(o.status) && live.length > 0 && live.every((i) => CANCELLABLE_ITEM.includes(i.status)));
  const pending = o.payments.filter((p) => p.status === "PENDING" || (p.status === "FAILED" && p.provider === "RAZORPAY")).at(-1) ?? null;
  const canPay = o.status === "PENDING_PAYMENT" && o.paymentMethod === mode && !!pending;

  const items = o.items.map((i) => {
    const delivered = i.deliveredAt ?? (i.status === "DELIVERED" ? o.deliveredAt : null);
    const returnBy = delivered ? new Date(delivered.getTime() + RETURN_WINDOW_DAYS * 86400_000) : null;
    const returnRequested = requested.has(i.id);
    return {
      id: i.id,
      productId: i.productId,
      slug: i.product.slug,
      name: i.name,
      brandName: i.brandName,
      size: i.size,
      imageUrl: i.imageUrl,
      art: { shape: i.product.shape, c1: i.product.colorPrimary, c2: i.product.colorSecondary },
      isOwnLabel: i.product.isOwnLabel,
      mrp: i.mrp,
      price: i.price,
      qty: i.qty,
      lineTotal: i.lineTotal,
      status: i.status,
      courier: i.courier,
      trackingNumber: i.trackingNumber,
      shippedAt: i.shippedAt?.toISOString() ?? null,
      deliveredAt: delivered?.toISOString() ?? null,
      sellerName: i.seller?.displayName ?? "The Big Brands Retail",
      returnable: i.status === "DELIVERED" && !!returnBy && returnBy.getTime() > now && !returnRequested,
      returnRequested,
      returnBy: returnBy?.toISOString() ?? null,
    };
  });
  const gifts = o.gifts.map((g) => ({
    id: g.id,
    giftItemId: g.giftItemId,
    productId: g.giftItem.productId,
    name: g.name,
    miniSize: g.miniSize,
    worth: g.worth,
    imageUrl: g.giftItem.product.images[0]?.url ?? null,
    art: { shape: g.giftItem.product.shape, c1: g.giftItem.product.colorPrimary, c2: g.giftItem.product.colorSecondary },
  }));
  const giftWorth = gifts.reduce((a, g) => a + g.worth, 0);

  let refundNote: string | null = null;
  if (o.paymentStatus === "REFUNDED") refundNote = `${formatINR(o.total)} has been refunded to your original payment method.`;
  else if (o.paymentStatus === "PAID" && (o.status === "CANCELLED" || o.status === "RETURNED")) {
    refundNote = `A refund of ${formatINR(o.total)} to your original payment method is being processed — it usually reaches you in 5–7 working days.`;
  }

  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    mrpTotal: o.mrpTotal,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    codFee: o.codFee,
    total: o.total,
    couponCode: o.couponCode,
    giftWorth,
    savings: Math.max(0, o.mrpTotal - o.subtotal) + o.discount + giftWorth,
    createdAt: o.createdAt.toISOString(),
    placedAt: o.placedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    eta: o.placedAt && !["DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"].includes(o.status) ? etaFrom(o.placedAt).toISOString() : null,
    address: { name: o.shipName, phone: o.shipPhone, line1: o.shipLine1, line2: o.shipLine2, landmark: o.shipLandmark, city: o.shipCity, state: o.shipState, pincode: o.shipPincode },
    items,
    gifts,
    events: o.events.map((e) => ({ id: e.id, status: e.status, note: e.note, actor: e.actor, at: e.createdAt.toISOString() })),
    payments: o.payments.map((p) => ({ id: p.id, provider: p.provider, status: p.status, amount: p.amount, providerPaymentId: p.providerPaymentId, at: p.createdAt.toISOString() })),
    canCancel,
    canPay,
    canReturn: items.some((i) => i.returnable),
    pendingPaymentId: canPay && pending?.provider === "TEST" ? pending.id : null,
    refundNote,
  };
}

export const cancelSchema = z.object({ reason: z.string().trim().max(200).optional() });

/** Customer cancel: unpaid orders, or paid/COD orders whose items haven't shipped yet. */
export async function cancelForCustomer(userId: string, number: string, reason?: string): Promise<OrderDetail> {
  const o = await getOrderDetail(userId, number);
  if (!o) throw err.notFound("Order not found");
  if (!o.canCancel) throw err.conflict("This order can't be cancelled any more — it has already shipped. You can request a return after delivery.");
  if (o.status === "PENDING_PAYMENT") await db.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
  await cancelOrder(o.id, "customer", reason ? `Cancelled by customer — ${reason}` : "Cancelled by customer");
  return (await getOrderDetail(userId, number))!;
}

export const RETURN_REASONS = {
  DAMAGED: "Arrived damaged or leaking",
  WRONG_ITEM: "Received the wrong item",
  NOT_AS_DESCRIBED: "Not as described",
  QUALITY: "Quality or authenticity concern",
  REACTION: "Skin reaction / allergy",
  OTHER: "Other",
} as const;

export const returnSchema = z.object({
  itemIds: z.array(z.string().trim().min(1).max(64)).min(1, "Choose at least one item").max(20),
  reason: z.enum(Object.keys(RETURN_REASONS) as [keyof typeof RETURN_REASONS, ...(keyof typeof RETURN_REASONS)[]]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Return request for delivered items within the 7-day window. Returns are completed by the admin team
 * (lifecycle RETURNED), so this records the request honestly: an OrderEvent on the timeline (visible to the
 * customer, seller and admin) plus an audit entry the admin console surfaces. No status is changed here.
 */
export async function requestReturn(userId: string, number: string, input: z.infer<typeof returnSchema>): Promise<OrderDetail> {
  const o = await getOrderDetail(userId, number);
  if (!o) throw err.notFound("Order not found");
  const byId = new Map(o.items.map((i) => [i.id, i]));
  const chosen = [...new Set(input.itemIds)].map((id) => byId.get(id));
  if (chosen.some((i) => !i)) throw err.badRequest("Choose items from this order");
  for (const i of chosen) {
    if (i!.returnRequested) throw err.conflict(`You've already asked to return ${i!.name}`);
    if (!i!.returnable) throw err.conflict(`${i!.name} can't be returned — returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery`);
  }
  const names = chosen.map((i) => (i!.qty > 1 ? `${i!.name} ×${i!.qty}` : i!.name)).join(", ");
  const reasonText = RETURN_REASONS[input.reason];
  await db.orderEvent.create({
    data: {
      orderId: o.id,
      status: o.status as OrderStatus,
      actor: "customer",
      note: `Return requested: ${names} — ${reasonText}${input.note ? ` (“${input.note}”)` : ""}. Our team will call within 24 hours to arrange a free pickup.`,
    },
  });
  await audit(userId, "order.return_requested", "Order", o.id, { number, itemIds: chosen.map((i) => i!.id), reason: input.reason, note: input.note ?? null });
  return (await getOrderDetail(userId, number))!;
}

/** Small numbers for the account overview. */
export async function getAccountStats(userId: string) {
  const [orders, active, saved] = await Promise.all([
    db.order.count({ where: { userId, status: { not: "PENDING_PAYMENT" } } }),
    db.order.count({ where: { userId, status: { in: [...ORDER_FILTERS.active] } } }),
    db.order.aggregate({ where: { userId, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, _sum: { mrpTotal: true, subtotal: true, discount: true } }),
  ]);
  const gifts = await db.orderGift.aggregate({ where: { order: { userId, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } }, _count: { _all: true }, _sum: { worth: true } });
  const s = saved._sum;
  return {
    orders,
    active,
    giftsReceived: gifts._count._all,
    giftWorth: gifts._sum.worth ?? 0,
    totalSaved: Math.max(0, (s.mrpTotal ?? 0) - (s.subtotal ?? 0)) + (s.discount ?? 0) + (gifts._sum.worth ?? 0),
  };
}
