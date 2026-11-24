import { randomBytes, randomInt } from "node:crypto";

/** URL slug from free text: "L'Oréal Paris Total Repair" → "loreal-paris-total-repair" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Order number: TBB + yymmdd + 4 random digits, e.g. TBB2611243817 */
export function orderNumber(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `TBB${yy}${mm}${dd}${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

/** Campaign code: CMP-XXXXXX */
export function campaignCode(): string {
  return "CMP-" + randomBytes(3).toString("hex").toUpperCase();
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/** 6-digit numeric OTP */
export function otpCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}
