import "server-only";
import { db, type Prisma, type Seller } from "@/lib/db";
import { err } from "@/lib/api";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth";
import { invalidate, TAGS } from "@/lib/cache";
import { maskAccount } from "@/components/seller/kyc";
import type { ProfileInput } from "./schemas";
import { getCategoryOptions } from "./options";

/**
 * BUSINESS PROFILE. Legal identity (business name, GSTIN, PAN, authorised brands) is read-only once approved;
 * changing it needs seller support (documents are re-verified). Bank changes require the account password and
 * are audited with masked before/after values. Status and commission are never editable here.
 */

export type SellerProfile = {
  id: string;
  slug: string;
  status: Seller["status"];
  businessName: string;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  gstin: string | null;
  pan: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bankAccountName: string | null;
  bankAccountNumberMasked: string;
  bankIfsc: string | null;
  upiId: string | null;
  categories: string[];
  brandsAuthorised: string[];
  description: string | null;
  logoUrl: string | null;
  commissionPct: number;
  approvedAt: string | null;
  createdAt: string;
};

export function toProfile(s: Seller): SellerProfile {
  return {
    id: s.id,
    slug: s.slug,
    status: s.status,
    businessName: s.businessName,
    displayName: s.displayName,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    gstin: s.gstin,
    pan: s.pan,
    addressLine: s.addressLine,
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    bankAccountName: s.bankAccountName,
    bankAccountNumberMasked: maskAccount(s.bankAccountNumber),
    bankIfsc: s.bankIfsc,
    upiId: s.upiId,
    categories: s.categories,
    brandsAuthorised: s.brandsAuthorised,
    description: s.description,
    logoUrl: s.logoUrl,
    commissionPct: s.commissionPct,
    approvedAt: s.approvedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

const BANK_KEYS = ["bankAccountName", "bankAccountNumber", "bankIfsc", "upiId"] as const;
const PLAIN_KEYS = ["displayName", "contactName", "email", "phone", "description", "addressLine", "city", "state", "pincode"] as const;

export async function updateSellerProfile(seller: Seller, userId: string, input: ProfileInput) {
  const data: Prisma.SellerUpdateInput = {};
  const changed: string[] = [];

  for (const k of PLAIN_KEYS) {
    const v = input[k];
    if (v === undefined) continue;
    if ((seller[k] ?? null) !== (v ?? null)) {
      (data as Record<string, unknown>)[k] = v;
      changed.push(k);
    }
  }

  if (input.categories) {
    const valid = new Set((await getCategoryOptions()).map((c) => c.slug));
    const cats = [...new Set(input.categories)].filter((c) => valid.has(c));
    if (!cats.length) throw err.badRequest("Pick at least one category", { fieldErrors: { categories: ["Pick at least one category"] } });
    if (JSON.stringify([...cats].sort()) !== JSON.stringify([...seller.categories].sort())) {
      data.categories = cats;
      changed.push("categories");
    }
  }

  if (input.logoUrl !== undefined && input.logoUrl !== seller.logoUrl) {
    if (input.logoUrl) {
      const media = await db.media.findFirst({ where: { url: input.logoUrl, uploadedById: userId }, select: { id: true } });
      if (!media) throw err.badRequest("Upload the logo with the uploader", { fieldErrors: { logoUrl: ["Logo wasn't uploaded from your account"] } });
    }
    data.logoUrl = input.logoUrl || null;
    changed.push("logoUrl");
  }

  const bankChanged = BANK_KEYS.filter((k) => input[k] !== undefined && (seller[k] ?? null) !== (input[k] ?? null));
  if (bankChanged.length) {
    if (!input.currentPassword) throw err.badRequest("Enter your password to change bank details", { fieldErrors: { currentPassword: ["Required to change bank details"] } });
    const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await verifyPassword(input.currentPassword, user?.passwordHash))) {
      throw err.badRequest("That password isn't right", { fieldErrors: { currentPassword: ["Incorrect password"] } });
    }
    for (const k of bankChanged) (data as Record<string, unknown>)[k] = input[k] ?? null;
  }

  if (!changed.length && !bankChanged.length) return { updated: false, profile: toProfile(seller) };

  const next = await db.seller.update({ where: { id: seller.id }, data });
  if (changed.length) await audit(userId, "seller.profile.update", "Seller", seller.id, { fields: changed });
  if (bankChanged.length) {
    await audit(userId, "seller.bank.update", "Seller", seller.id, {
      fields: bankChanged,
      before: { name: seller.bankAccountName, account: maskAccount(seller.bankAccountNumber), ifsc: seller.bankIfsc, upi: seller.upiId },
      after: { name: next.bankAccountName, account: maskAccount(next.bankAccountNumber), ifsc: next.bankIfsc, upi: next.upiId },
    });
  }
  invalidate(TAGS.sellers);
  return { updated: true, profile: toProfile(next), bankChanged: bankChanged.length > 0 };
}
