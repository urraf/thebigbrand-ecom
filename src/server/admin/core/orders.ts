import "server-only";
import { z } from "zod";
import { db, type OrderItemStatus, type OrderStatus, type Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canMoveItem, setItemStatus, setOrderStatus } from "@/server/orders/lifecycle";
import { adminActor, lifecycleError } from "./guard";
import { addDays, parseIstDay } from "./time";

// ───────────── list ─────────────

export const STATUS_GROUPS: Record<string, OrderStatus[]> = {
  PENDING_PAYMENT: ["PENDING_PAYMENT"],
  PLACED: ["PLACED"],
  CONFIRMED: ["CONFIRMED"],
  PACKED: ["PACKED"],
  SHIPPED: ["SHIPPED", "OUT_FOR_DELIVERY"],
  DELIVERED: ["DELIVERED"],
  CANCELLED: ["CANCELLED"],
  RETURNED: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
};

export const OrderListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(Object.keys(STATUS_GROUPS) as [string, ...string[]]).optional(),
  method: z.enum(["RAZORPAY", "COD", "TEST", "PREPAID"]).optional(),
  pay: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "COD_PENDING"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seller: z.string().trim().max(40).optional(), // seller id or "tbb"
  sort: z.enum(["placed", "total", "number"]).default("placed"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OrderListQuery = z.infer<typeof OrderListQuery>;

function listWhere(q: OrderListQuery, withStatus = true): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (q.q) {
    const ci = { contains: q.q, mode: "insensitive" as const };
    const digits = q.q.replace(/\D/g, "");
    and.push({
      OR: [
        { number: ci },
        { shipName: ci },
        { shipCity: ci },
        ...(digits.length >= 4 ? [{ shipPhone: { contains: digits } }, { user: { phone: { contains: digits } } }] : []),
        { user: { OR: [{ name: ci }, { email: ci }] } },
      ],
    });
  }
  if (withStatus && q.status) and.push({ status: { in: STATUS_GROUPS[q.status] } });
  if (q.method === "PREPAID") and.push({ paymentMethod: { in: ["RAZORPAY", "TEST"] } });
  else if (q.method) and.push({ paymentMethod: q.method });
  if (q.pay) and.push({ paymentStatus: q.pay });
  const from = parseIstDay(q.from);
  const to = parseIstDay(q.to);
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: addDays(to, 1) } : {}) } });
  if (q.seller === "tbb") and.push({ items: { some: { sellerId: null } } });
  else if (q.seller) and.push({ items: { some: { sellerId: q.seller } } });
  return and.length ? { AND: and } : {};
}

export async function listOrders(q: OrderListQuery) {
  const where = listWhere(q);
  const orderBy: Prisma.OrderOrderByWithRelationInput =
    q.sort === "total" ? { total: q.dir } : q.sort === "number" ? { number: q.dir } : { createdAt: q.dir };
  const [total, rows, byStatus] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        number: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        placedAt: true,
        shipName: true,
        shipCity: true,
        shipPhone: true,
        couponCode: true,
        user: { select: { id: true, name: true, email: true } },
        items: { select: { qty: true, status: true, sellerId: true, seller: { select: { displayName: true } } } },
        gifts: { select: { name: true, giftItem: { select: { product: { select: { colorPrimary: true } } } } } },
      },
    }),
    db.order.groupBy({ by: ["status"], where: listWhere(q, false), _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = { ALL: 0 };
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    counts[group] = byStatus.filter((b) => statuses.includes(b.status)).reduce((t, b) => t + b._count._all, 0);
    counts.ALL += counts[group];
  }
  const items = rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    placedAt: o.placedAt?.toISOString() ?? null,
    customer: { id: o.user.id, name: o.user.name || o.shipName, email: o.user.email },
    shipName: o.shipName,
    city: o.shipCity,
    phone: o.shipPhone,
    couponCode: o.couponCode,
    itemCount: o.items.reduce((t, i) => t + i.qty, 0),
    sellers: [...new Set(o.items.map((i) => i.seller?.displayName ?? "The Big Brands Retail"))],
    gifts: o.gifts.map((g) => ({ name: g.name, c1: g.giftItem.product.colorPrimary })),
  }));
  return { ...paged(items, total, q.page, q.limit), counts };
}

// ───────────── detail ─────────────

const ITEM_ACTIONS: OrderItemStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

export async function getOrderDetail(number: string) {
  const o = await db.order.findUnique({
    where: { number },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, isActive: true, _count: { select: { orders: true } } } },
      items: {
        orderBy: { id: "asc" },
        include: {
          seller: { select: { id: true, displayName: true, slug: true } },
          product: {
            select: {
              id: true,
              slug: true,
              sku: true,
              shape: true,
              colorPrimary: true,
              colorSecondary: true,
              isOwnLabel: true,
              images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
              brand: { select: { name: true, word: true, isOwn: true } },
            },
          },
        },
      },
      gifts: { include: { giftItem: { select: { productId: true, product: { select: { colorPrimary: true, slug: true } } } } } },
      payments: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      couponUses: { select: { discount: true, coupon: { select: { code: true, title: true } } } },
    },
  });
  if (!o) return null;
  const items = o.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productSlug: i.product.slug,
    sku: i.product.sku,
    name: i.name,
    brandName: i.brandName,
    size: i.size,
    imageUrl: i.imageUrl ?? i.product.images[0]?.url ?? null,
    art: { shape: i.product.shape, c1: i.product.colorPrimary, c2: i.product.colorSecondary },
    isOwnLabel: i.product.isOwnLabel,
    brand: i.product.brand,
    mrp: i.mrp,
    price: i.price,
    qty: i.qty,
    lineTotal: i.lineTotal,
    status: i.status,
    courier: i.courier,
    trackingNumber: i.trackingNumber,
    shippedAt: i.shippedAt?.toISOString() ?? null,
    deliveredAt: i.deliveredAt?.toISOString() ?? null,
    seller: i.seller,
    commissionPct: i.commissionPct,
    commissionAmt: i.commissionAmt,
    sellerEarning: i.sellerEarning,
    next: o.status === "PENDING_PAYMENT" ? [] : ITEM_ACTIONS.filter((to) => canMoveItem(i.status, to)),
  }));
  const orderNext =
    o.status === "PENDING_PAYMENT"
      ? (["CANCELLED"] as OrderItemStatus[])
      : ITEM_ACTIONS.filter((to) => items.some((i) => canMoveItem(i.status, to)));
  // customer's actors on the timeline: resolve admin ids → names
  const adminIds = [...new Set(o.events.map((e) => e.actor).filter((a): a is string => !!a && a.startsWith("admin:")).map((a) => a.slice(6)))];
  const sellerIds = [...new Set(o.events.map((e) => e.actor).filter((a): a is string => !!a && a.startsWith("seller:")).map((a) => a.slice(7)))];
  const [admins, sellers] = await Promise.all([
    adminIds.length ? db.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }) : [],
    sellerIds.length ? db.seller.findMany({ where: { OR: [{ id: { in: sellerIds } }, { userId: { in: sellerIds } }] }, select: { id: true, userId: true, displayName: true } }) : [],
  ]);
  const actorName = (a: string | null) => {
    if (!a || a === "system") return "System";
    if (a === "customer") return "Customer";
    if (a.startsWith("admin:")) return admins.find((x) => x.id === a.slice(6))?.name ?? "Admin";
    if (a.startsWith("seller:")) {
      const id = a.slice(7);
      return sellers.find((s) => s.id === id || s.userId === id)?.displayName ?? "Seller";
    }
    return a;
  };
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
    coupon: o.couponUses[0]?.coupon ?? null,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    placedAt: o.placedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    address: {
      name: o.shipName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      landmark: o.shipLandmark,
      city: o.shipCity,
      state: o.shipState,
      pincode: o.shipPincode,
    },
    customer: { ...o.user, createdAt: o.user.createdAt.toISOString(), orderCount: o.user._count.orders },
    items,
    gifts: o.gifts.map((g) => ({ id: g.id, name: g.name, miniSize: g.miniSize, worth: g.worth, c1: g.giftItem.product.colorPrimary, productSlug: g.giftItem.product.slug })),
    payments: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    events: o.events.map((e) => ({ id: e.id, status: e.status, note: e.note, actor: e.actor, actorName: actorName(e.actor), createdAt: e.createdAt.toISOString() })),
    next: orderNext,
    canRefund: o.paymentStatus === "PAID" && ["CANCELLED", "RETURNED", "RETURN_REQUESTED"].includes(o.status),
  };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

// ───────────── actions (all status changes go through the lifecycle) ─────────────

const Target = z.enum(["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]);

export const OrderStatusBody = z.object({
  to: Target,
  note: z.string().trim().max(300).optional(),
  courier: z.string().trim().max(60).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
});

export const ItemStatusBody = OrderStatusBody;

async function orderByNumber(number: string) {
  const o = await db.order.findUnique({ where: { number }, select: { id: true, number: true, status: true, items: { select: { id: true, status: true } } } });
  if (!o) throw err.notFound("Order not found");
  return o;
}

export async function changeOrderStatus(number: string, body: z.infer<typeof OrderStatusBody>, actorUserId: string) {
  const o = await orderByNumber(number);
  const actor = adminActor(actorUserId);
  if (body.to === "SHIPPED" && !body.courier) throw err.badRequest("Choose the courier to ship with", { fieldErrors: { courier: ["Choose a courier"] } });
  const movable = o.items.filter((i) => canMoveItem(i.status, body.to));
  if (!movable.length && !(o.status === "PENDING_PAYMENT" && body.to === "CANCELLED")) {
    throw err.conflict(`No items in this order can be marked ${body.to.toLowerCase()}`);
  }
  let status: OrderStatus;
  try {
    if (body.to === "SHIPPED") {
      // ship each eligible item so courier + tracking are recorded on every line
      status = o.status;
      for (const i of movable) {
        status = await setItemStatus(i.id, "SHIPPED", actor, { courier: body.courier, trackingNumber: body.trackingNumber, note: body.note });
      }
    } else {
      status = await setOrderStatus(o.id, body.to, actor, body.note);
    }
  } catch (e) {
    lifecycleError(e);
  }
  await audit(actorUserId, `order.${body.to.toLowerCase()}`, "Order", o.id, { number, to: body.to, items: movable.length, courier: body.courier ?? null, tracking: body.trackingNumber ?? null });
  return { number, status };
}

export async function changeItemStatus(number: string, itemId: string, body: z.infer<typeof ItemStatusBody>, actorUserId: string) {
  const o = await orderByNumber(number);
  if (!o.items.some((i) => i.id === itemId)) throw err.notFound("This item isn't part of the order");
  if (body.to === "SHIPPED" && !body.courier) throw err.badRequest("Choose the courier to ship with", { fieldErrors: { courier: ["Choose a courier"] } });
  let status: OrderStatus;
  try {
    status = await setItemStatus(itemId, body.to, adminActor(actorUserId), { courier: body.courier, trackingNumber: body.trackingNumber, note: body.note });
  } catch (e) {
    lifecycleError(e);
  }
  await audit(actorUserId, `order.item.${body.to.toLowerCase()}`, "Order", o.id, { number, itemId, to: body.to, courier: body.courier ?? null, tracking: body.trackingNumber ?? null });
  return { number, status };
}

export const OrderNoteBody = z.object({ note: z.string().trim().min(2).max(500) });

/** Internal note on the timeline (does not change status). */
export async function addOrderNote(number: string, note: string, actorUserId: string) {
  const o = await orderByNumber(number);
  const ev = await db.orderEvent.create({ data: { orderId: o.id, status: o.status, note, actor: adminActor(actorUserId) } });
  await audit(actorUserId, "order.note", "Order", o.id, { number, note });
  return { id: ev.id };
}

/** Record that a prepaid order's money was refunded (after cancel/return). Payment bookkeeping only. */
export async function markOrderRefunded(number: string, actorUserId: string, note?: string) {
  const o = await db.order.findUnique({ where: { number }, select: { id: true, status: true, paymentStatus: true, total: true } });
  if (!o) throw err.notFound("Order not found");
  if (o.paymentStatus !== "PAID") throw err.conflict("Only paid orders can be marked refunded");
  if (!["CANCELLED", "RETURNED", "RETURN_REQUESTED"].includes(o.status)) throw err.conflict("Cancel the order or mark it returned before refunding");
  await db.$transaction([
    db.order.update({ where: { id: o.id }, data: { paymentStatus: "REFUNDED" } }),
    db.payment.updateMany({ where: { orderId: o.id, status: "PAID" }, data: { status: "REFUNDED" } }),
    db.orderEvent.create({ data: { orderId: o.id, status: o.status, note: note ? `Refund of ₹${o.total} recorded · ${note}` : `Refund of ₹${o.total} recorded`, actor: adminActor(actorUserId) } }),
  ]);
  await audit(actorUserId, "order.refund", "Order", o.id, { number, amount: o.total });
  return { number, paymentStatus: "REFUNDED" as const };
}

export const COURIERS = ["Delhivery", "Blue Dart", "Xpressbees", "Ekart", "Shadowfax", "DTDC", "India Post"];

/** Header numbers for the orders page (whole store, unfiltered). */
export async function orderStats() {
  const [placed, toShip, transit, cod, gifts] = await Promise.all([
    db.order.count({ where: { status: "PLACED" } }),
    db.order.count({ where: { status: { in: ["CONFIRMED", "PACKED"] } } }),
    db.order.count({ where: { status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] } } }),
    db.order.aggregate({ where: { paymentStatus: "COD_PENDING", status: { notIn: ["CANCELLED", "RETURNED", "REFUNDED"] } }, _sum: { total: true }, _count: { _all: true } }),
    db.orderGift.count({ where: { order: { status: { in: ["PLACED", "CONFIRMED", "PACKED"] } } } }),
  ]);
  return { placed, toShip, transit, codAmount: cod._sum.total ?? 0, codCount: cod._count._all, giftsToPack: gifts };
}
