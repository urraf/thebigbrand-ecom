import "server-only";
import { db, type OrderItemStatus, type Prisma, type Seller } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { setItemStatus } from "@/server/orders/lifecycle";
import { maskPhone } from "@/components/seller/kyc";
import type { FulfilInput } from "./schemas";

/**
 * SELLER ORDERS — only order items where sellerId = me, only paid/placed orders (never PENDING_PAYMENT).
 * Other sellers' items, the customer's account, email and order totals are never exposed. The full shipping
 * address + phone are shown only while one of my items still needs fulfilment (PLACED…SHIPPED).
 * Status changes go exclusively through src/server/orders/lifecycle.ts with { sellerId }.
 */

export const ORDER_TABS = {
  all: null,
  open: ["PLACED", "CONFIRMED", "PACKED"],
  new: ["PLACED"],
  confirmed: ["CONFIRMED"],
  packed: ["PACKED"],
  shipped: ["SHIPPED"],
  delivered: ["DELIVERED"],
  closed: ["CANCELLED", "RETURNED"],
} as const satisfies Record<string, readonly OrderItemStatus[] | null>;
export type OrderTab = keyof typeof ORDER_TABS;
export const ORDER_TAB_KEYS = Object.keys(ORDER_TABS) as OrderTab[];

const OPEN: OrderItemStatus[] = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED"];

const itemSelect = {
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
  commissionPct: true,
  commissionAmt: true,
  sellerEarning: true,
  product: { select: { slug: true, sku: true, shape: true, colorPrimary: true, colorSecondary: true } },
} satisfies Prisma.OrderItemSelect;

type ItemRow = Prisma.OrderItemGetPayload<{ select: typeof itemSelect }>;

export type SellerOrderItem = {
  id: string;
  productId: string;
  slug: string;
  sku: string | null;
  name: string;
  brandName: string;
  size: string | null;
  imageUrl: string | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
  mrp: number;
  price: number;
  qty: number;
  lineTotal: number;
  status: OrderItemStatus;
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  commissionPct: number;
  commissionAmt: number;
  sellerEarning: number;
};

export type ShipTo = {
  name: string;
  city: string;
  state: string;
  pincode: string;
  /** present only while fulfilment is open */
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  phone?: string;
  phoneMasked: string;
};

export type SellerOrder = {
  id: string;
  number: string;
  placedAt: string;
  payment: "Prepaid" | "Cash on delivery";
  items: SellerOrderItem[];
  itemsTotal: number;
  earning: number;
  units: number;
  /** most-behind status among my live items */
  stage: OrderItemStatus;
  shipTo: ShipTo;
  open: boolean;
};

const STAGE_ORDER: OrderItemStatus[] = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED"];

function toItem(i: ItemRow): SellerOrderItem {
  return {
    id: i.id,
    productId: i.productId,
    slug: i.product.slug,
    sku: i.product.sku,
    name: i.name,
    brandName: i.brandName,
    size: i.size,
    imageUrl: i.imageUrl,
    art: { shape: i.product.shape, c1: i.product.colorPrimary, c2: i.product.colorSecondary },
    mrp: i.mrp,
    price: i.price,
    qty: i.qty,
    lineTotal: i.lineTotal,
    status: i.status,
    courier: i.courier,
    trackingNumber: i.trackingNumber,
    shippedAt: i.shippedAt?.toISOString() ?? null,
    deliveredAt: i.deliveredAt?.toISOString() ?? null,
    commissionPct: i.commissionPct,
    commissionAmt: i.commissionAmt,
    sellerEarning: i.sellerEarning,
  };
}

type OrderRow = Prisma.OrderGetPayload<{
  select: {
    id: true;
    number: true;
    createdAt: true;
    placedAt: true;
    paymentMethod: true;
    shipName: true;
    shipPhone: true;
    shipLine1: true;
    shipLine2: true;
    shipLandmark: true;
    shipCity: true;
    shipState: true;
    shipPincode: true;
    items: { select: typeof itemSelect };
  };
}>;

function toOrder(o: OrderRow, full: boolean): SellerOrder {
  const items = o.items.map(toItem);
  const live = items.filter((i) => i.status !== "CANCELLED");
  const stage = (live.length ? live : items).reduce<OrderItemStatus>(
    (min, i) => (STAGE_ORDER.indexOf(i.status) < STAGE_ORDER.indexOf(min) ? i.status : min),
    (live.length ? live : items)[0]?.status ?? "PLACED",
  );
  const open = items.some((i) => OPEN.includes(i.status));
  const shipTo: ShipTo = { name: o.shipName, city: o.shipCity, state: o.shipState, pincode: o.shipPincode, phoneMasked: open ? maskPhone(o.shipPhone) : "" };
  if (full && open) Object.assign(shipTo, { line1: o.shipLine1, line2: o.shipLine2, landmark: o.shipLandmark, phone: o.shipPhone });
  const counted = items.filter((i) => i.status !== "CANCELLED");
  return {
    id: o.id,
    number: o.number,
    placedAt: (o.placedAt ?? o.createdAt).toISOString(),
    payment: o.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid",
    items,
    itemsTotal: counted.reduce((s, i) => s + i.lineTotal, 0),
    earning: counted.filter((i) => i.status !== "RETURNED").reduce((s, i) => s + i.sellerEarning, 0),
    units: counted.reduce((s, i) => s + i.qty, 0),
    stage,
    shipTo,
    open,
  };
}

function orderSelect(sellerId: string) {
  return {
    id: true,
    number: true,
    createdAt: true,
    placedAt: true,
    paymentMethod: true,
    shipName: true,
    shipPhone: true,
    shipLine1: true,
    shipLine2: true,
    shipLandmark: true,
    shipCity: true,
    shipState: true,
    shipPincode: true,
    items: { where: { sellerId }, select: itemSelect, orderBy: { id: "asc" as const } },
  } satisfies Prisma.OrderSelect;
}

const PAID: Prisma.OrderWhereInput = { status: { not: "PENDING_PAYMENT" } };

export async function listSellerOrders(
  sellerId: string,
  opts: { tab?: OrderTab; q?: string; from?: string; to?: string; page?: number; limit?: number } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 15));
  const statuses = ORDER_TABS[opts.tab ?? "all"];
  const q = opts.q?.trim();
  const created: Prisma.DateTimeFilter = {};
  if (opts.from) created.gte = new Date(`${opts.from}T00:00:00+05:30`);
  if (opts.to) created.lte = new Date(`${opts.to}T23:59:59.999+05:30`);
  const where: Prisma.OrderWhereInput = {
    ...PAID,
    items: { some: { sellerId, ...(statuses ? { status: { in: [...statuses] } } : {}) } },
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { items: { some: { sellerId, name: { contains: q, mode: "insensitive" } } } },
            { shipName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(created.gte || created.lte ? { createdAt: created } : {}),
  };
  const [rows, total, statusCounts] = await Promise.all([
    db.order.findMany({ where, select: orderSelect(sellerId), orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    db.order.count({ where }),
    db.orderItem.groupBy({ by: ["status"], where: { sellerId, order: PAID }, _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(statusCounts.map((c) => [c.status, c._count._all])) as Partial<Record<OrderItemStatus, number>>;
  const counts = Object.fromEntries(
    ORDER_TAB_KEYS.map((k) => {
      const s = ORDER_TABS[k];
      return [k, s ? s.reduce((n, st) => n + (byStatus[st] ?? 0), 0) : Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0)];
    }),
  ) as Record<OrderTab, number>;
  return { items: rows.map((o) => toOrder(o, false)), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), counts };
}

export type SellerTimelineEvent = { status: string; at: string; note?: string };
export type SellerOrderDetail = SellerOrder & { timeline: SellerTimelineEvent[] };

const AUDIT_STATUS: Record<string, OrderItemStatus> = { "order.item.confirm": "CONFIRMED", "order.item.pack": "PACKED", "order.item.ship": "SHIPPED" };

/**
 * Timeline of MY items in the order. Order-level events only move when every seller's items move (roll-up), so
 * the seller's own progress comes from their fulfilment audit trail (confirm / pack / ship), delivery timestamps
 * and the order's terminal events (cancelled / returned). Same-step actions within a few minutes are grouped.
 */
async function sellerTimeline(
  o: { placedAt: Date | null; createdAt: Date; events: { status: string; createdAt: Date }[] },
  items: SellerOrderItem[],
): Promise<SellerTimelineEvent[]> {
  const ids = items.map((i) => i.id);
  const logs = ids.length
    ? await db.auditLog.findMany({
        where: { entity: "OrderItem", entityId: { in: ids }, action: { in: Object.keys(AUDIT_STATUS) } },
        select: { action: true, entityId: true, createdAt: true, data: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const raw: { status: string; at: Date; itemId?: string; note?: string }[] = [{ status: "PLACED", at: o.placedAt ?? o.createdAt }];
  for (const l of logs) {
    const d = (l.data ?? {}) as { courier?: string; trackingNumber?: string };
    raw.push({ status: AUDIT_STATUS[l.action], at: l.createdAt, itemId: l.entityId ?? undefined, note: d.courier ? `${d.courier} · AWB ${d.trackingNumber ?? ""}`.trim() : undefined });
  }
  for (const i of items) if (i.deliveredAt) raw.push({ status: "DELIVERED", at: new Date(i.deliveredAt), itemId: i.id });
  for (const e of o.events) if (["CANCELLED", "RETURNED"].includes(e.status)) raw.push({ status: e.status, at: e.createdAt });
  raw.sort((a, b) => a.at.getTime() - b.at.getTime());

  const out: (SellerTimelineEvent & { _t: number; _n: number })[] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && last.status === r.status && r.at.getTime() - last._t < 10 * 60_000) {
      last._n += r.itemId ? 1 : 0;
      continue;
    }
    out.push({ status: r.status, at: r.at.toISOString(), note: r.note, _t: r.at.getTime(), _n: r.itemId ? 1 : 0 });
  }
  return out.map(({ _t, _n, ...e }) => {
    void _t;
    const count = items.length > 1 && _n > 0 ? `${_n} of ${items.length} items` : undefined;
    return { ...e, note: [count, e.note].filter(Boolean).join(" · ") || undefined };
  });
}

export async function getSellerOrder(sellerId: string, number: string): Promise<SellerOrderDetail | null> {
  const o = await db.order.findFirst({
    where: { number, ...PAID, items: { some: { sellerId } } },
    select: { ...orderSelect(sellerId), events: { select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!o) return null;
  const order = toOrder(o, true);
  return { ...order, timeline: await sellerTimeline(o, order.items) };
}

const ACTION_TO: Record<FulfilInput["action"], { to: OrderItemStatus; from: OrderItemStatus[]; verb: string }> = {
  confirm: { to: "CONFIRMED", from: ["PLACED"], verb: "confirmed" },
  pack: { to: "PACKED", from: ["PLACED", "CONFIRMED"], verb: "packed" },
  ship: { to: "SHIPPED", from: ["PACKED"], verb: "shipped" },
};

function lifecycleError(e: unknown): never {
  const m = e instanceof Error ? e.message : "";
  if (m === "FORBIDDEN_ITEM") throw err.forbidden("That item isn't yours");
  if (m === "ORDER_NOT_PAID") throw err.conflict("This order hasn't been paid yet");
  if (m.startsWith("INVALID_TRANSITION")) throw err.conflict("This item has already moved on — refresh to see its latest status");
  throw e;
}

/** Confirm / pack / ship my items in one order (all eligible items unless itemIds is given). */
export async function fulfilOrder(seller: Seller, userId: string, number: string, input: FulfilInput) {
  const order = await db.order.findFirst({
    where: { number, ...PAID, items: { some: { sellerId: seller.id } } },
    select: { id: true, number: true, items: { where: { sellerId: seller.id }, select: { id: true, status: true } } },
  });
  if (!order) throw err.notFound("Order not found");
  const rule = ACTION_TO[input.action];
  const wanted = input.itemIds?.length ? new Set(input.itemIds) : null;
  if (wanted && [...wanted].some((id) => !order.items.some((i) => i.id === id))) throw err.forbidden("Some items aren't part of your order");
  const targets = order.items.filter((i) => (!wanted || wanted.has(i.id)) && rule.from.includes(i.status));
  if (!targets.length) throw err.conflict(`Nothing to mark as ${rule.verb} — items may have moved on already`);

  let orderStatus: string | null = null;
  for (const it of targets) {
    try {
      orderStatus = await setItemStatus(it.id, rule.to, `seller:${seller.id}`, {
        sellerId: seller.id,
        ...(input.action === "ship" ? { courier: input.courier, trackingNumber: input.trackingNumber } : {}),
      });
    } catch (e) {
      lifecycleError(e);
    }
    await audit(userId, `order.item.${input.action}`, "OrderItem", it.id, {
      order: order.number,
      ...(input.action === "ship" ? { courier: input.courier, trackingNumber: input.trackingNumber } : {}),
    });
  }
  return { number: order.number, updated: targets.length, to: rule.to, orderStatus };
}

/** Single-item status change (mobile app / API). */
export async function setSellerItemStatus(seller: Seller, userId: string, itemId: string, input: Omit<FulfilInput, "itemIds">) {
  const item = await db.orderItem.findFirst({ where: { id: itemId, sellerId: seller.id, order: PAID }, select: { order: { select: { number: true } } } });
  if (!item) throw err.notFound("Order item not found");
  return fulfilOrder(seller, userId, item.order.number, { ...input, itemIds: [itemId] });
}
