import { parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidate, TAGS } from "@/lib/cache";
import { db } from "@/lib/db";
import { getSettings, integrationStatus, SettingsPatch, updateSettings } from "@/server/admin/core/settings";

/** GET /api/v1/admin/settings (ADMIN only) → { store, shipping, trending, integrations (read-only, from env), team } */
export const GET = route({ auth: "superadmin" }, async () => {
  const [settings, team] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } }),
  ]);
  return { ...settings, integrations: integrationStatus(), team };
});

/**
 * PATCH /api/v1/admin/settings (ADMIN only) { store?: {...}, shipping?: {...}, trending?: string[] } — merge-patch per section.
 * store: name, legalName, gstin, supportEmail, supportPhone, address, invoicePrefix
 * shipping: shippingFee, freeShippingMin, codEnabled, codFee, codMaxOrder, partner, dispatchDays
 */
export const PATCH = route({ auth: "superadmin" }, async ({ req, auth }) => {
  const body = await parseBody(req, SettingsPatch);
  const res = await updateSettings(body);
  invalidate(TAGS.settings);
  await audit(auth!.user.id, "settings.update", "Setting", res.sections.join(","), body as object);
  return res;
});
