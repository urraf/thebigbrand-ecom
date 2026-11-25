import { z } from "zod";

/**
 * Account / address validation — shared by the API (server) and the checkout & address-book forms (client),
 * so a shopper sees exactly the server's rules. Client-safe: no server imports.
 */

export const INDIAN_STATES = [
  "Andaman & Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const PHONE_RE = /^[6-9]\d{9}$/;

/** "+91 98765 43210" / "098765-43210" → "9876543210" (unchanged digits when it can't be normalised). */
export function cleanPhone(input: string): string {
  return String(input ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/\s+/g, " ") : null));

export const addressSchema = z.object({
  label: optText(20),
  name: z.string().trim().min(3, "Enter the receiver's full name").max(80, "Name is too long"),
  phone: z
    .string()
    .transform(cleanPhone)
    .pipe(z.string().regex(PHONE_RE, "Enter a valid 10-digit mobile number")),
  line1: z.string().trim().min(5, "Add the house number and street").max(160, "Keep it under 160 characters"),
  line2: optText(160),
  landmark: optText(80),
  city: z.string().trim().min(2, "Enter your town or city").max(60),
  state: z.enum(INDIAN_STATES, { error: "Select your state" }),
  pincode: z.string().trim().regex(PINCODE_RE, "Enter a valid 6-digit pincode"),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

export const addressPatchSchema = addressSchema.partial();

export const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80).optional(),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"))]).optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined, { message: "Nothing to update" });

/** zod issues → { field: firstMessage } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
