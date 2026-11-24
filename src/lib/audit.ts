import "server-only";
import { db, type Prisma } from "@/lib/db";

/** Record an admin/seller action. Never throws (audit must not break the main flow). */
export async function audit(
  actorId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Prisma.InputJsonValue,
) {
  try {
    await db.auditLog.create({ data: { actorId: actorId ?? null, action, entity, entityId: entityId ?? null, data } });
  } catch (e) {
    console.error("[audit] failed", action, e);
  }
}
