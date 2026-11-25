import "server-only";
import { db, type Seller } from "@/lib/db";
import { brandLiteSelect, toBrandLite } from "@/server/catalog/cards";
import { getCategoryOptions, getConcernOptions } from "./options";
import { allowedBrandsFor } from "./products";

/** Lookups for the product editor: the seller's authorised brands (with wordmark styling for the preview). */
export async function getEditorOptions(seller: Seller) {
  const [allowed, categories, concerns] = await Promise.all([allowedBrandsFor(seller), getCategoryOptions(), getConcernOptions()]);
  const brandRows = await db.brand.findMany({ where: { id: { in: allowed.map((b) => b.id) } }, select: brandLiteSelect, orderBy: { name: "asc" } });
  return { brands: brandRows.map(toBrandLite), categories, concerns, commissionPct: seller.commissionPct };
}
