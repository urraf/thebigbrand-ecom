import { z } from "zod";
import { parseQuery, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ledgerCsv, ledgerQuery, listLedger } from "@/server/admin/growth/payouts";
import { csvResponse } from "@/server/admin/growth/util";

/**
 * GET /api/v1/admin/payouts/ledger?sellerId&type&from=yyyy-mm-dd&to=yyyy-mm-dd&page&limit (admin) → paged ledger entries + net
 * GET …/ledger?format=csv → CSV download of every matching entry (IST timestamps)
 */
const Query = ledgerQuery.extend({ format: z.enum(["json", "csv"]).default("json") });

export const GET = route({ auth: "admin" }, async ({ req, auth }) => {
  const { format, ...q } = parseQuery(req, Query);
  if (format === "csv") {
    const { filename, csv } = await ledgerCsv(q);
    await audit(auth!.user.id, "ledger.export", "SellerLedgerEntry", q.sellerId ?? null, { from: q.from ?? null, to: q.to ?? null, type: q.type ?? null });
    return csvResponse(filename, csv);
  }
  return listLedger(q);
});
