/**
 * Seller KYC format checks (client-safe — used by the registration form for instant feedback AND by the
 * server-side zod schemas, so both always agree).
 *
 *   GSTIN  15 chars: 2-digit state code · 10-char PAN · entity no. · "Z" · check character (mod-36 checksum)
 *   PAN    10 chars: AAAAA9999A, 4th letter = holder type (C company, F firm, P individual …)
 *   IFSC   11 chars: 4-letter bank code · "0" · 6-char branch code
 */

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const GSTIN_RE = /^(0[1-9]|[12][0-9]|3[0-8]|97)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;

/** Uppercase + strip spaces (users paste "07 AAB…" or lowercase). */
export const normKyc = (v: string) => v.replace(/\s+/g, "").toUpperCase();

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36];
}

/** null when valid, else a human message. */
export function gstinError(raw: string): string | null {
  const g = normKyc(raw);
  if (!g) return "Enter your GSTIN";
  if (g.length !== 15) return "GSTIN has 15 characters";
  if (!GSTIN_RE.test(g)) return "This doesn't look like a GSTIN (e.g. 27AAPCU1234K1Z0)";
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return "GSTIN check digit doesn't match — please re-check it";
  return null;
}

export function panError(raw: string): string | null {
  const p = normKyc(raw);
  if (!p) return "Enter your PAN";
  if (!PAN_RE.test(p)) return "PAN looks like AAPCU1234K (10 characters)";
  return null;
}

/** PAN embedded in a GSTIN (characters 3–12). */
export const panFromGstin = (gstin: string) => normKyc(gstin).slice(2, 12);

export function ifscError(raw: string): string | null {
  const v = normKyc(raw);
  if (!v) return "Enter the IFSC";
  if (!IFSC_RE.test(v)) return "IFSC looks like HDFC0001234 (11 characters)";
  return null;
}

/** "9876543210" → "98•••••210" (never show full customer numbers outside fulfilment). */
export function maskPhone(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 6) return d ? "••••" : "";
  return `${d.slice(0, 2)}${"•".repeat(Math.max(0, d.length - 5))}${d.slice(-3)}`;
}

/** "731407632680" → "••••••••2680" */
export function maskAccount(acc: string | null | undefined): string {
  const d = String(acc ?? "");
  if (d.length <= 4) return d;
  return `${"•".repeat(d.length - 4)}${d.slice(-4)}`;
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

/** GST state code → state (to pre-fill the address state from a GSTIN). */
export const GST_STATE: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh",
};
