import "server-only";
import { db, type Seller, type User } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { hashPassword, isAdminRole, type AuthContext } from "@/lib/auth";
import { invalidate, TAGS } from "@/lib/cache";
import { slugify } from "@/lib/ids";
import type { ApplyInput } from "./schemas";
import { getBrandOptions, getCategoryOptions } from "./options";

/**
 * SELLER APPLICATION (Sell on TBB → register → admin approval).
 * - Signed out: creates the User (role SELLER) + Seller (PENDING) in one transaction; the route then signs them in.
 * - Signed in (customer): attaches a Seller to the existing account and upgrades the role to SELLER.
 * - PENDING / REJECTED seller: updates the application and puts it back in the review queue.
 * Sellers can never set their own status to APPROVED or change their commission.
 */

const RESERVED_SLUGS = new Set(["www", "admin", "seller", "sellers", "api", "app", "store", "help", "support", "tbb", "thebigbrands", "login", "register"]);

export async function uniqueSellerSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name).slice(0, 40) || "store";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 && !RESERVED_SLUGS.has(base) ? base : `${base}-${i + 1}`;
    const hit = await db.seller.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Keep only real category slugs; map brand names onto the catalogue's spelling where they match. */
async function cleanLists(input: Pick<ApplyInput, "categories" | "brandsAuthorised">) {
  const [cats, brands] = await Promise.all([getCategoryOptions(), getBrandOptions()]);
  const catSlugs = new Set(cats.map((c) => c.slug));
  const categories = [...new Set(input.categories)].filter((c) => catSlugs.has(c));
  if (!categories.length) throw err.badRequest("Pick at least one category", { fieldErrors: { categories: ["Pick at least one category"] } });
  const byLower = new Map(brands.map((b) => [b.name.toLowerCase(), b.name]));
  const brandsAuthorised = [...new Set(input.brandsAuthorised.map((b) => byLower.get(b.trim().toLowerCase()) ?? b.trim()))].filter(Boolean);
  return { categories, brandsAuthorised };
}

function sellerData(input: ApplyInput, lists: { categories: string[]; brandsAuthorised: string[] }) {
  return {
    businessName: input.businessName,
    displayName: input.displayName,
    contactName: input.name,
    email: input.email,
    phone: input.mobile,
    gstin: input.gstin,
    pan: input.pan,
    addressLine: input.addressLine,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    bankAccountName: input.bankAccountName,
    bankAccountNumber: input.bankAccountNumber,
    bankIfsc: input.bankIfsc,
    upiId: input.upiId,
    categories: lists.categories,
    brandsAuthorised: lists.brandsAuthorised,
    description: input.description,
  };
}

async function assertGstinFree(gstin: string, exceptSellerId?: string) {
  const dupe = await db.seller.findFirst({ where: { gstin, ...(exceptSellerId ? { id: { not: exceptSellerId } } : {}) }, select: { id: true } });
  if (dupe) throw err.conflict("A seller account with this GSTIN already exists — sign in instead", { fieldErrors: { gstin: ["Already registered"] } });
}

export type ApplyResult = { user: User; seller: Seller; isNewUser: boolean; resubmitted: boolean };

export async function submitApplication(input: ApplyInput, auth: AuthContext | null): Promise<ApplyResult> {
  const lists = await cleanLists(input);

  // ── signed-out: brand-new account ──
  if (!auth) {
    if (!input.password) throw err.badRequest("Choose a password", { fieldErrors: { password: ["Choose a password"] } });
    const [byEmail, byPhone] = await Promise.all([
      db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      db.user.findUnique({ where: { phone: input.mobile }, select: { id: true } }),
    ]);
    if (byEmail) throw err.conflict("An account with this email already exists — sign in to continue your application", { fieldErrors: { email: ["Already registered — sign in instead"] } });
    if (byPhone) throw err.conflict("This mobile number is already registered — sign in to continue", { fieldErrors: { mobile: ["Already registered"] } });
    await assertGstinFree(input.gstin);
    const slug = await uniqueSellerSlug(input.displayName);
    const passwordHash = await hashPassword(input.password);
    const { user, seller } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, phone: input.mobile, passwordHash, role: "SELLER" } });
      const seller = await tx.seller.create({ data: { userId: user.id, slug, status: "PENDING", ...sellerData(input, lists) } });
      return { user, seller };
    });
    await audit(user.id, "seller.apply", "Seller", seller.id, { displayName: seller.displayName, new: true });
    invalidate(TAGS.sellers);
    return { user, seller, isNewUser: true, resubmitted: false };
  }

  // ── signed-in ──
  const user = await db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  if (isAdminRole(user.role)) throw err.forbidden("Staff accounts can't apply as sellers — use a separate email");
  const existing = await db.seller.findUnique({ where: { userId: user.id } });

  if (existing) {
    if (existing.status === "APPROVED") throw err.conflict("Your seller account is already approved");
    if (existing.status === "SUSPENDED") throw err.forbidden("This seller account is suspended — contact seller support");
    await assertGstinFree(input.gstin, existing.id);
    const seller = await db.seller.update({
      where: { id: existing.id },
      // status back to the review queue; commission and approval fields are never client-controlled
      data: { ...sellerData(input, lists), status: "PENDING", rejectionReason: null },
    });
    await audit(user.id, existing.status === "REJECTED" ? "seller.resubmit" : "seller.update_application", "Seller", seller.id, { from: existing.status });
    invalidate(TAGS.sellers);
    return { user, seller, isNewUser: false, resubmitted: existing.status === "REJECTED" };
  }

  // customer account → seller
  await assertGstinFree(input.gstin);
  const phoneOwner = user.phone ? null : await db.user.findUnique({ where: { phone: input.mobile }, select: { id: true } });
  const slug = await uniqueSellerSlug(input.displayName);
  const { u, seller } = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { role: "SELLER", name: user.name ?? input.name, ...(!user.phone && !phoneOwner ? { phone: input.mobile } : {}) },
    });
    const seller = await tx.seller.create({ data: { userId: user.id, slug, status: "PENDING", ...sellerData(input, lists) } });
    return { u, seller };
  });
  await audit(user.id, "seller.apply", "Seller", seller.id, { displayName: seller.displayName, upgradedFrom: user.role });
  invalidate(TAGS.sellers);
  return { user: u, seller, isNewUser: false, resubmitted: false };
}

export type ApplicationView = {
  id: string;
  slug: string;
  status: Seller["status"];
  rejectionReason: string | null;
  displayName: string;
  businessName: string;
  submittedAt: string;
  updatedAt: string;
  approvedAt: string | null;
  commissionPct: number;
  /** editable application (prefills the resubmit form) */
  form: Omit<ApplyInput, "password" | "acceptTerms" | "description"> & { description: string };
};

export async function getApplication(userId: string): Promise<ApplicationView | null> {
  const s = await db.seller.findUnique({ where: { userId } });
  if (!s) return null;
  return {
    id: s.id,
    slug: s.slug,
    status: s.status,
    rejectionReason: s.rejectionReason,
    displayName: s.displayName,
    businessName: s.businessName,
    submittedAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    approvedAt: s.approvedAt?.toISOString() ?? null,
    commissionPct: s.commissionPct,
    form: {
      name: s.contactName,
      email: s.email,
      mobile: s.phone,
      businessName: s.businessName,
      displayName: s.displayName,
      gstin: s.gstin ?? "",
      pan: s.pan ?? "",
      addressLine: s.addressLine ?? "",
      city: s.city ?? "",
      state: s.state ?? "",
      pincode: s.pincode ?? "",
      categories: s.categories,
      brandsAuthorised: s.brandsAuthorised,
      description: s.description ?? "",
      bankAccountName: s.bankAccountName ?? "",
      bankAccountNumber: s.bankAccountNumber ?? "",
      bankIfsc: s.bankIfsc ?? "",
      upiId: s.upiId ?? null,
    },
  };
}
