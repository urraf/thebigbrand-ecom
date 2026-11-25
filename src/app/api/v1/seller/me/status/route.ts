import { route } from "@/lib/api";
import { getApplication } from "@/server/seller/apply";

/** GET /api/v1/seller/me/status — the signed-in user's seller application (null when they haven't applied). */
export const GET = route({ auth: "user" }, async ({ auth }) => {
  const app = await getApplication(auth!.user.id);
  if (!app) return { application: null };
  const { form, ...rest } = app;
  // bank account number is returned masked; the full form only matters while it can be edited
  const editable = app.status === "PENDING" || app.status === "REJECTED";
  return {
    application: {
      ...rest,
      form: editable ? form : { ...form, bankAccountNumber: form.bankAccountNumber.replace(/.(?=.{4})/g, "•") },
      editable,
    },
  };
});
