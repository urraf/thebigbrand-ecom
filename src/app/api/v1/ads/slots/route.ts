import { route } from "@/lib/api";
import { listSlotCards, listSlots } from "@/server/ads/slots";

/**
 * GET /api/v1/ads/slots            → AdSlotInfo[] — the public rate card (code, page, name, format, size,
 *                                     pricingModel, rate, rateLabel, positions, potentialMonthly, isActive)
 * GET /api/v1/ads/slots?detail=1   → adds bookable, description, live campaigns, fill (0..1) and reach per day
 * GET /api/v1/ads/slots?format=csv  → the rate card as a CSV download
 */
export const GET = route({ auth: "public" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  if (sp.get("format") === "csv") {
    const cards = await listSlotCards();
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Code", "Page", "Placement", "Format", "Size", "Pricing model", "Rate (INR)", "Rate", "Positions", "Est. reach per day", "Self-serve", "Status"],
      ...cards.map((c) => [c.code, c.page, c.name, c.format, c.size, c.pricingModel, c.rate, c.rateLabel, c.positions, Math.round(c.reach.imp), c.bookable ? "yes" : "no", c.isActive ? "active" : "paused"]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="the-big-brands-rate-card.csv"', "cache-control": "public, max-age=300" },
    });
  }
  if (sp.get("detail") === "1") return listSlotCards();
  return listSlots();
});
