import "server-only";
import { z } from "zod";
import { db, type Prisma } from "@/lib/db";
import { err, paged } from "@/lib/api";
import { audit } from "@/lib/audit";

/**
 * CONTACT MESSAGES — the public /contact form (POST /api/v1/support/contact) and the admin inbox
 * (/admin/messages). Messages are plain records; replies go out by email/phone from the support team.
 */

export const CONTACT_TOPICS = {
  order: "An order I placed",
  return: "Return, refund or cancellation",
  payment: "Payment or invoice",
  product: "A product or the free gift",
  account: "My account or sign-in",
  brand: "Selling, brands or advertising",
  other: "Something else",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export const MESSAGE_STATUSES = ["NEW", "REPLIED", "CLOSED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const ContactInput = z.object({
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]),
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91)(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(30)
    .regex(/^[A-Z0-9-]*$/, "Order numbers look like TBB2611256169")
    .optional()
    .transform((v) => v || undefined),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  /** honeypot — real users never fill it */
  website: z.string().max(0).optional(),
});
export type ContactInput = z.infer<typeof ContactInput>;

export async function submitContact(input: ContactInput, meta: { userId?: string | null; ip?: string | null }) {
  if (input.website) throw err.badRequest("Message could not be sent");
  const msg = await db.contactMessage.create({
    data: {
      topic: input.topic,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      orderNumber: input.orderNumber ?? null,
      message: input.message,
      userId: meta.userId ?? null,
      ip: meta.ip ?? null,
    },
    select: { id: true, createdAt: true },
  });
  return { id: msg.id, reference: `MSG-${msg.id.slice(-6).toUpperCase()}`, createdAt: msg.createdAt.toISOString() };
}

// ───────────── admin inbox ─────────────

export const MessageListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type MessageListQuery = z.infer<typeof MessageListQuery>;

export async function listMessages(q: MessageListQuery) {
  const and: Prisma.ContactMessageWhereInput[] = [];
  if (q.q) {
    const ci = { contains: q.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: ci }, { email: ci }, { phone: ci }, { orderNumber: ci }, { message: ci }] });
  }
  if (q.status) and.push({ status: q.status });
  if (q.topic) and.push({ topic: q.topic });
  const where: Prisma.ContactMessageWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    db.contactMessage.count({ where }),
    db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit }),
  ]);
  return paged(
    rows.map((m) => ({ ...m, topicLabel: CONTACT_TOPICS[m.topic as ContactTopic] ?? m.topic, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })),
    total,
    q.page,
    q.limit,
  );
}

export async function messageCounts() {
  const rows = await db.contactMessage.groupBy({ by: ["status"], _count: { _all: true } });
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<MessageStatus, number>>;
  return { NEW: by.NEW ?? 0, REPLIED: by.REPLIED ?? 0, CLOSED: by.CLOSED ?? 0 };
}

export const MessagePatch = z.object({ status: z.enum(MESSAGE_STATUSES) });

export async function setMessageStatus(id: string, status: MessageStatus, actorId: string) {
  const cur = await db.contactMessage.findUnique({ where: { id }, select: { status: true } });
  if (!cur) throw err.notFound("Message not found");
  const m = await db.contactMessage.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  await audit(actorId, "message.status", "ContactMessage", id, { from: cur.status, to: status });
  return m;
}
