import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/auth";
import { parseQuery, rateLimit, route } from "@/lib/api";
import { getSuggestions } from "@/server/search/suggest";

/**
 * GET /api/v1/search/suggest?q=onion&cat=oil → SuggestResult
 * { q, sponsored (slot S1 or null), concerns[], brands[], products[] (max 5), trending[] }
 * Empty q → the default sponsored suggestion + trending searches.
 */
const Query = z.object({
  q: z.string().max(120).optional().default(""),
  cat: z.string().max(40).optional(),
});

export const GET = route({ auth: "public" }, async ({ req }) => {
  rateLimit(`suggest:${clientIp(req) ?? "anon"}`, 300, 60_000);
  const { q, cat } = parseQuery(req, Query);
  const data = await getSuggestions(q, cat);
  return NextResponse.json({ data }, { headers: { "cache-control": "private, max-age=30" } });
});
