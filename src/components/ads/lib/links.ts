/**
 * Tracked ad links (client-safe). Every creative links through the click redirect so clicks are counted
 * server-side (CPC billing) even without JavaScript:  /api/v1/ads/click/<campaignId>?to=<same-site path>
 */
export const CLICK_BASE = "/api/v1/ads/click/";

/** Only same-site relative paths are allowed as redirect targets (no `//host`, no `\`, no schemes). */
export function isSafeRelativePath(to: string | null | undefined): to is string {
  if (!to || typeof to !== "string") return false;
  if (to.length > 500) return false;
  if (!to.startsWith("/") || to.startsWith("//") || to.startsWith("/\\")) return false;
  if (/[\u0000-\u001f\\]/.test(to)) return false;
  return true;
}

export function clickUrlFor(campaignId: string, to: string | null | undefined): string {
  const dest = to && to.trim() ? to.trim() : "/";
  return `${CLICK_BASE}${encodeURIComponent(campaignId)}?to=${encodeURIComponent(dest)}`;
}

/** Tracked link for a served creative, optionally to a different same-site page (e.g. a product). */
export function trackedHref(ad: { id: string; clickUrl: string }, to?: string | null): string {
  if (!to) return ad.clickUrl;
  return clickUrlFor(ad.id, to);
}
