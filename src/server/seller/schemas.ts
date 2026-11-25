import "server-only";
import { z } from "zod";
import { normalizePhone } from "@/lib/sms";
import {
  ACCOUNT_RE,
  INDIAN_STATES,
  PINCODE_RE,
  UPI_RE,
  gstinError,
  ifscError,
  normKyc,
  panError,
  panFromGstin,
} from "@/components/seller/kyc";

/** Input schemas for the seller API (shared by Route Handlers and server code). */

const trimmed = (min: number, max: number, msg?: string) => z.string().trim().min(min, msg ?? `At least ${min} characters`).max(max, `At most ${max} characters`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const mobileField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
      return z.NEVER;
    }
    return p;
  });

export const gstinField = z
  .string()
  .transform(normKyc)
  .superRefine((v, ctx) => {
    const e = gstinError(v);
    if (e) ctx.addIssue({ code: "custom", message: e });
  });

export const panField = z
  .string()
  .transform(normKyc)
  .superRefine((v, ctx) => {
    const e = panError(v);
    if (e) ctx.addIssue({ code: "custom", message: e });
  });

export const ifscField = z
  .string()
  .transform(normKyc)
  .superRefine((v, ctx) => {
    const e = ifscError(v);
    if (e) ctx.addIssue({ code: "custom", message: e });
  });

export const accountField = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => ACCOUNT_RE.test(v), "Account number has 9–18 digits");

export const upiField = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || UPI_RE.test(v), "UPI ID looks like name@bank");

/** PATCH variants: undefined = leave unchanged, "" / null = clear. */
const patchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));
const patchUpi = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null))
  .refine((v) => v == null || UPI_RE.test(v), "UPI ID looks like name@bank");

export const pincodeField = z.string().trim().refine((v) => PINCODE_RE.test(v), "Enter a 6-digit PIN code");
export const stateField = z.enum(INDIAN_STATES as unknown as [string, ...string[]], { message: "Choose a state" });

const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "Use letters and at least one number");

/** POST /api/v1/seller/apply — flat so field errors map 1:1 to form inputs. */
export const ApplySchema = z
  .object({
    // account (ignored when already signed in)
    name: trimmed(2, 80, "Enter your full name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    mobile: mobileField,
    password: passwordField.optional(),
    // business
    businessName: trimmed(2, 120, "Enter the legal business name"),
    displayName: trimmed(2, 60, "Enter a store name shoppers will see"),
    gstin: gstinField,
    pan: panField,
    addressLine: trimmed(5, 200, "Enter the pickup address"),
    city: trimmed(2, 60, "Enter the city"),
    state: stateField,
    pincode: pincodeField,
    categories: z.array(z.string().trim().min(1).max(40)).min(1, "Pick at least one category").max(12),
    brandsAuthorised: z.array(z.string().trim().min(1).max(60)).min(1, "Add at least one brand you are authorised to sell").max(25),
    description: optionalText(600),
    // bank
    bankAccountName: trimmed(2, 120, "Enter the account holder name"),
    bankAccountNumber: accountField,
    bankIfsc: ifscField,
    upiId: upiField,
    acceptTerms: z.literal(true, { message: "Please accept the seller terms" }),
  })
  .superRefine((v, ctx) => {
    if (!v.gstin || !v.pan) return;
    if (panFromGstin(v.gstin) !== v.pan) ctx.addIssue({ code: "custom", path: ["pan"], message: "PAN must match characters 3–12 of your GSTIN" });
  });
export type ApplyInput = z.infer<typeof ApplySchema>;

export const PRODUCT_SHAPES = ["bottle", "tube", "dropper", "jar", "pump", "stick"] as const;
const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #5b35e0")
  .optional()
  .nullable()
  .transform((v) => v || null);

export const ProductSchema = z
  .object({
    name: trimmed(3, 160, "Enter the product name"),
    brandId: z.string().min(1, "Choose a brand"),
    categoryId: z.string().min(1, "Choose a category"),
    size: optionalText(40),
    sku: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : null))
      .refine((v) => v === null || /^[A-Z0-9][A-Z0-9._/-]{1,63}$/.test(v), "SKU: letters, numbers, - _ . /"),
    mrp: z.coerce.number().int("Whole rupees only").min(1, "MRP must be at least ₹1").max(500000),
    price: z.coerce.number().int("Whole rupees only").min(1, "Price must be at least ₹1").max(500000),
    stock: z.coerce.number().int().min(0, "Stock can't be negative").max(100000),
    description: optionalText(5000),
    howToUse: optionalText(3000),
    ingredients: optionalText(5000),
    bullets: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
    concerns: z.array(z.string().trim().min(1).max(40)).max(9).default([]),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
    images: z
      .array(z.object({ url: z.string().trim().min(1).max(500), alt: optionalText(160) }))
      .max(8, "Up to 8 photos")
      .default([]),
    shape: z.enum(PRODUCT_SHAPES).optional().nullable().transform((v) => v ?? null),
    colorPrimary: hex,
    colorSecondary: hex,
    /** true → send for approval (PENDING) · false → save as draft */
    submit: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.price > v.mrp) ctx.addIssue({ code: "custom", path: ["price"], message: "Selling price can't be more than MRP" });
  });
export type ProductInput = z.infer<typeof ProductSchema>;

export const InventorySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        stock: z.coerce.number().int().min(0).max(100000).optional(),
        price: z.coerce.number().int().min(1).max(500000).optional(),
      }),
    )
    .min(1, "Nothing to update")
    .max(200),
});

export const COURIERS = ["Delhivery", "Blue Dart", "DTDC", "Ekart", "Xpressbees", "Ecom Express", "Shadowfax", "Shiprocket", "India Post", "Other"] as const;

export const FulfilSchema = z
  .object({
    action: z.enum(["confirm", "pack", "ship"]),
    itemIds: z.array(z.string().min(1)).max(50).optional(),
    courier: z.string().trim().max(40).optional(),
    trackingNumber: z
      .preprocess(
        (v) => (typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() || undefined : v),
        z.string().regex(/^[A-Z0-9-]{6,40}$/, "Tracking number: 6–40 letters/numbers").optional(),
      ),
  })
  .superRefine((v, ctx) => {
    if (v.action !== "ship") return;
    if (!v.courier) ctx.addIssue({ code: "custom", path: ["courier"], message: "Choose the courier" });
    if (!v.trackingNumber) ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Enter the AWB / tracking number" });
  });
export type FulfilInput = z.infer<typeof FulfilSchema>;

export const ProfileSchema = z.object({
  displayName: trimmed(2, 60).optional(),
  contactName: trimmed(2, 80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
  phone: mobileField.optional(),
  description: patchText(600),
  addressLine: trimmed(5, 200).optional(),
  city: trimmed(2, 60).optional(),
  state: stateField.optional(),
  pincode: pincodeField.optional(),
  categories: z.array(z.string().trim().min(1).max(40)).min(1, "Pick at least one category").max(12).optional(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  bankAccountName: trimmed(2, 120).optional(),
  bankAccountNumber: accountField.optional(),
  bankIfsc: ifscField.optional(),
  upiId: patchUpi,
  /** required when any bank field changes */
  currentPassword: z.string().max(200).optional(),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const BookSchema = z
  .object({
    productId: z.string().min(1, "Choose a product"),
    slotCode: z.enum(["S3", "P1"], { message: "Choose a placement" }),
    startDate: day,
    endDate: day,
    // matches the ads area's minimum for performance (CPC) campaigns; the ads endpoint re-checks it
    budget: z.coerce.number().int("Whole rupees only").min(5000, "Minimum budget is ₹5,000").max(5000000),
    keywords: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(15).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
  });
export type BookInput = z.infer<typeof BookSchema>;

export { passwordField };
