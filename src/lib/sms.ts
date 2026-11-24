import "server-only";
import { env } from "@/lib/env";

/**
 * OTP delivery. Uses MSG91 when configured; otherwise logs to the server console.
 * When OTP_DEV_MODE=true the caller may also return the code to the client (demo/staging only).
 */
export async function sendOtpSms(phone: string, code: string): Promise<{ delivered: boolean; channel: "msg91" | "console" }> {
  if (env.msg91.enabled) {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "content-type": "application/json", authkey: env.msg91.authKey },
      body: JSON.stringify({ template_id: env.msg91.templateId, mobile: `91${phone}`, otp: code }),
      cache: "no-store",
    });
    if (!res.ok) console.error("[sms] MSG91 send failed", res.status, await res.text().catch(() => ""));
    return { delivered: res.ok, channel: "msg91" };
  }
  console.info(`[sms:dev] OTP for +91 ${phone} is ${code}`);
  return { delivered: false, channel: "console" };
}

/** Normalise an Indian mobile number to 10 digits, or null if invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
