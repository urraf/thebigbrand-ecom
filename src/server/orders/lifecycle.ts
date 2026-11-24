import "server-only";
import { db, type OrderItemStatus, type OrderStatus, type Prisma } from "@/lib/db";

/**
 * ORDER LIFECYCLE — the ONLY place that changes order / item status. Used by checkout, admin and the seller portal.
 *
 * Item statuses roll up into the order status. On DELIVERED a seller item credits the seller ledger
 * (SALE_CREDIT + COMMISSION_DEBIT); on CANCELLED stock is restored; on RETURNED a REFUND_DEBIT reverses the earning.
 * Every change writes an OrderEvent (timeline shown to customer, seller and admin).
 */

type Tx = Prisma.TransactionClient;
export type Actor = string; // "system" | "customer" | `admin:${id}` | `seller:${id}`

const ITEM_ORDER: OrderItemStatus[] = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

/** Allowed forward transitions for a single item. */
export function canMoveItem(from: OrderItemStatus, to: OrderItemStatus): boolean {
  if (from === to) return false;
  if (from === "CANCELLED" || from === "RETURNED") return false;
  if (to === "CANCELLED") return ["PLACED", "CONFIRMED", "PACKED"].includes(from);
  if (to === "RETURNED") return from === "DELIVERED";
  return ITEM_ORDER.indexOf(to) > ITEM_ORDER.indexOf(from);
}

/** Order status derived from its items (ignoring cancelled ones unless all are cancelled). */
export function rollUp(items: { status: OrderItemStatus }[]): OrderStatus {
  const live = items.filter((i) => i.status !== "CANCELLED");
  if (!live.length) return "CANCELLED";
  if (live.every((i) => i.status === "RETURNED")) return "RETURNED";
  const active = live.filter((i) => i.status !== "RETURNED");
  const min = Math.min(...active.map((i) => ITEM_ORDER.indexOf(i.status as OrderItemStatus)));
  return (["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] as OrderStatus[])[Math.max(0, min)];
}

async function applyItemSideEffects(tx: Tx, item: Prisma.OrderItemGetPayload<object>, to: OrderItemStatus, orderNumber: string) {
  if (to === "CANCELLED") {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } });
  }
  if (to === "DELIVERED" && item.sellerId) {
    const exists = await tx.sellerLedgerEntry.findFirst({ where: { orderItemId: item.id, type: "SALE_CREDIT" } });
    if (!exists) {
      await tx.sellerLedgerEntry.createMany({
        data: [
          { sellerId: item.sellerId, type: "SALE_CREDIT", amount: item.lineTotal, orderItemId: item.id, note: `Order ${orderNumber}` },
          { sellerId: item.sellerId, type: "COMMISSION_DEBIT", amount: -item.commissionAmt, orderItemId: item.id, note: `${item.commissionPct}% commission · ${orderNumber}` },
        ],
      });
    }
  }
  if (to === "RETURNED") {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } });
    if (item.sellerId) {
      await tx.sellerLedgerEntry.create({
        data: { sellerId: item.sellerId, type: "REFUND_DEBIT", amount: -item.sellerEarning, orderItemId: item.id, note: `Return · ${orderNumber}` },
      });
    }
  }
}

async function syncOrder(tx: Tx, orderId: string, actor: Actor, note?: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { select: { status: true } } } });
  const next = rollUp(order.items);
  if (next !== order.status && order.status !== "PENDING_PAYMENT") {
    const data: Prisma.OrderUpdateInput = { status: next };
    if (next === "DELIVERED") {
      data.deliveredAt = new Date();
      if (order.paymentMethod === "COD") data.paymentStatus = "PAID";
    }
    if (next === "CANCELLED") data.cancelledAt = new Date();
    await tx.order.update({ where: { id: orderId }, data });
    await tx.orderEvent.create({ data: { orderId, status: next, actor, note } });
  }
  return next;
}

/**
 * Move one order item to `to`. Returns the new order status.
 * `opts.sellerId` restricts the change to that seller's items (seller portal).
 */
export async function setItemStatus(
  itemId: string,
  to: OrderItemStatus,
  actor: Actor,
  opts: { sellerId?: string; courier?: string; trackingNumber?: string; note?: string } = {},
): Promise<OrderStatus> {
  return db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId }, include: { order: { select: { id: true, number: true, status: true } } } });
    if (opts.sellerId && item.sellerId !== opts.sellerId) throw new Error("FORBIDDEN_ITEM");
    if (item.order.status === "PENDING_PAYMENT") throw new Error("ORDER_NOT_PAID");
    if (!canMoveItem(item.status, to)) throw new Error(`INVALID_TRANSITION:${item.status}->${to}`);
    const data: Prisma.OrderItemUpdateInput = { status: to };
    if (to === "SHIPPED") {
      data.shippedAt = new Date();
      if (opts.courier) data.courier = opts.courier;
      if (opts.trackingNumber) data.trackingNumber = opts.trackingNumber;
    }
    if (to === "DELIVERED") data.deliveredAt = new Date();
    await tx.orderItem.update({ where: { id: itemId }, data });
    await applyItemSideEffects(tx, item, to, item.order.number);
    return syncOrder(tx, item.order.id, actor, opts.note);
  });
}

/** Move every eligible item of an order to `to` (admin bulk action / customer cancel). */
export async function setOrderStatus(orderId: string, to: OrderItemStatus, actor: Actor, note?: string): Promise<OrderStatus> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status === "PENDING_PAYMENT" && to !== "CANCELLED") throw new Error("ORDER_NOT_PAID");
    for (const item of order.items) {
      if (!canMoveItem(item.status, to)) continue;
      const data: Prisma.OrderItemUpdateInput = { status: to };
      if (to === "SHIPPED") data.shippedAt = new Date();
      if (to === "DELIVERED") data.deliveredAt = new Date();
      await tx.orderItem.update({ where: { id: item.id }, data });
      await applyItemSideEffects(tx, item, to, order.number);
    }
    if (order.status === "PENDING_PAYMENT" && to === "CANCELLED") {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.orderEvent.create({ data: { orderId, status: "CANCELLED", actor, note } });
      return "CANCELLED" as OrderStatus;
    }
    return syncOrder(tx, orderId, actor, note);
  });
}

/**
 * Called once payment succeeds (or for COD at placement): PENDING_PAYMENT → PLACED.
 * Idempotent — safe to call from both the browser callback and the gateway webhook.
 */
export async function markOrderPlaced(orderId: string, actor: Actor = "system"): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PENDING_PAYMENT") return false;
    await tx.order.update({ where: { id: orderId }, data: { status: "PLACED", placedAt: new Date() } });
    await tx.orderEvent.create({ data: { orderId, status: "PLACED", actor } });
    return true;
  });
}
