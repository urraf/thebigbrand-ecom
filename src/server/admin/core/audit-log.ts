import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { paged } from "@/lib/api";
import { addDays, parseIstDay } from "./time";

export const AuditQuery = z.object({
  q: z.string().trim().max(80).optional(),
  entity: z.string().trim().max(40).optional(),
  actor: z.string().trim().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

export async function listAudit(q: AuditQuery) {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (q.q) and.push({ OR: [{ action: { contains: q.q, mode: "insensitive" } }, { entityId: q.q }, { actor: { name: { contains: q.q, mode: "insensitive" } } }] });
  if (q.entity) and.push({ entity: q.entity });
  if (q.actor) and.push({ actorId: q.actor });
  const from = parseIstDay(q.from);
  const to = parseIstDay(q.to);
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: addDays(to, 1) } : {}) } });
  const where: Prisma.AuditLogWhereInput = { AND: and };
  const [total, rows, entities, actors] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit, include: { actor: { select: { id: true, name: true, email: true, role: true } } } }),
    db.auditLog.groupBy({ by: ["entity"], _count: { _all: true }, orderBy: { entity: "asc" } }),
    db.auditLog.groupBy({ by: ["actorId"], _count: { _all: true } }),
  ]);
  const actorUsers = await db.user.findMany({ where: { id: { in: actors.map((a) => a.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true, role: true } });
  return {
    ...paged(
      rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, data: r.data, createdAt: r.createdAt.toISOString(), actor: r.actor })),
      total,
      q.page,
      q.limit,
    ),
    facets: {
      entities: entities.map((e) => ({ entity: e.entity, count: e._count._all })),
      actors: actorUsers.map((u) => ({ id: u.id, name: u.name ?? u.email ?? "User", role: u.role })),
    },
  };
}

/** Admin URL for an audited entity (null when there's no page for it). */
export function entityHref(entity: string, id: string | null, data: unknown): string | null {
  if (!id) return null;
  const d = (data ?? {}) as Record<string, unknown>;
  switch (entity) {
    case "Order":
      return typeof d.number === "string" ? `/admin/orders/${d.number}` : null;
    case "Product":
      return `/admin/products/${id}`;
    case "User":
      return `/admin/customers/${id}`;
    case "Brand":
      return "/admin/brands";
    case "Category":
      return "/admin/brands?tab=categories";
    case "GiftItem":
    case "GiftTier":
      return "/admin/gifts";
    case "Coupon":
      return "/admin/coupons";
    case "Review":
      return "/admin/reviews";
    case "Seller":
      return "/admin/sellers";
    case "AdCampaign":
      return "/admin/campaigns";
    case "AdSlot":
      return "/admin/ads";
    default:
      return null;
  }
}
