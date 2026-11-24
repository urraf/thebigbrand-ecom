import "server-only";

/** Typed access to environment configuration. Server-only. */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:3200",
  rootDomain: process.env.ROOT_DOMAIN ?? "localhost:3200",
  isProd: process.env.NODE_ENV === "production",
  otpDevMode: (process.env.OTP_DEV_MODE ?? "").toLowerCase() === "true",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    get enabled() {
      return Boolean(this.keyId && this.keySecret);
    },
  },
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY ?? "",
    templateId: process.env.MSG91_TEMPLATE_ID ?? "",
    get enabled() {
      return Boolean(this.authKey && this.templateId);
    },
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "blob",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  },
};

export function assertAuthSecret(): Uint8Array {
  if (!env.authSecret || env.authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(env.authSecret);
}
