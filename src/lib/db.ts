import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single Prisma client per server process (re-used across hot reloads in dev).
 * Import as: `import { db } from "@/lib/db"` — server code only.
 */
const globalForPrisma = globalThis as unknown as { __tbbPrisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.__tbbPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__tbbPrisma = db;

export * from "@/generated/prisma/client";
