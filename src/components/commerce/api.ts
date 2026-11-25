/**
 * Tiny client helper for the commerce islands: calls /api/v1/** and unwraps `{ data }`, throwing a
 * CommerceError with the API's code / message / details on failure. Client-safe (no server imports).
 */
export class CommerceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown> & { fieldErrors?: Record<string, string[]> },
  ) {
    super(message);
  }
}

export async function capi<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      credentials: "same-origin",
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  } catch {
    throw new CommerceError(0, "NETWORK", "You seem to be offline — check your connection and try again");
  }
  let body: { data?: T; error?: { code?: string; message?: string; details?: CommerceError["details"] } } | null = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new CommerceError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? "Something went wrong — please try again", body?.error?.details);
  }
  return body?.data as T;
}

/** First message per field from a VALIDATION_ERROR (z.flattenError) response. */
export function apiFieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof CommerceError && e.details?.fieldErrors) {
    for (const [k, v] of Object.entries(e.details.fieldErrors)) if (Array.isArray(v) && v[0]) out[k] = v[0];
  }
  return out;
}

/** Copy of a record without one key (clearing a field error). */
export function omit<T extends Record<string, unknown>>(o: T, k: string): T {
  const next = { ...o };
  delete next[k];
  return next;
}

export const errMessage = (e: unknown, fallback = "Something went wrong — please try again") => (e instanceof Error && e.message ? e.message : fallback);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Tue, 24 Nov" */
export function shortDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** "24 Nov 2026, 3:42 pm" */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/** Human labels for order / item statuses. */
export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export const PAY_LABEL: Record<string, string> = {
  COD: "Cash on delivery",
  RAZORPAY: "Paid online (Razorpay)",
  TEST: "Online payment (test mode)",
};

/** pill tone per status */
export function statusTone(s: string): "ok" | "warn" | "bad" | "info" | "mute" {
  if (s === "DELIVERED") return "ok";
  if (s === "PENDING_PAYMENT" || s === "RETURN_REQUESTED") return "warn";
  if (s === "CANCELLED") return "bad";
  if (s === "RETURNED" || s === "REFUNDED") return "mute";
  return "info";
}
