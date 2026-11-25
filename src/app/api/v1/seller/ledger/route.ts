import { z } from "zod";
import { NextResponse } from "next/server";
import { paginationSchema, parseQuery, route } from "@/lib/api";
import { getSellerBalance, ledgerCsv, LEDGER_TYPES, listLedger } from "@/server/seller/ledger";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Query = paginationSchema.extend({
  type: z.enum(LEDGER_TYPES as [string, ...string[]]).optional(),
  from: day.optional(),
  to: day.optional(),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * GET /api/v1/seller/ledger?type=&from=&to=&page=&limit=  → { balance, items, totals, … }
 * GET /api/v1/seller/ledger?format=csv                     → CSV download of the (filtered) ledger
 */
export const GET = route({ auth: "seller" }, async ({ req, seller }) => {
  const q = parseQuery(req, Query);
  const filter = { type: q.type as (typeof LEDGER_TYPES)[number] | undefined, from: q.from, to: q.to, page: q.page, limit: q.limit };
  if (q.format === "csv") {
    const csv = await ledgerCsv(seller!.id, filter);
    const name = `tbb-ledger-${seller!.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
    });
  }
  const [balance, ledger] = await Promise.all([getSellerBalance(seller!.id), listLedger(seller!.id, filter)]);
  return { ...balance, ...ledger };
});
