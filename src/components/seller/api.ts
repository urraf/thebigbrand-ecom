/**
 * Tiny client for /api/v1 used by the seller portal's interactive islands. Same endpoints the seller
 * mobile app will call. Throws ApiFailure with the server's message + field errors.
 */

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}

type Init = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T = unknown>(path: string, init: Init = {}): Promise<T> {
  // x-tbb-scope: use the seller-portal session even on shared endpoints (e.g. /api/v1/ads/book/…)
  const headers: Record<string, string> = { accept: "application/json", "x-tbb-scope": "seller" };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body, signal: init.signal, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiFailure("Network error — check your connection and try again", 0, "NETWORK");
  }
  let json: { data?: T; error?: { code: string; message: string; details?: { fieldErrors?: Record<string, string[]> } } } = {};
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok || json.error) {
    const e = json.error;
    throw new ApiFailure(e?.message ?? `Request failed (${res.status})`, res.status, e?.code ?? "ERROR", e?.details?.fieldErrors ?? {});
  }
  return json.data as T;
}

/** First field error, or the general message. */
export function errorText(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiFailure) {
    const first = Object.entries(e.fields).find(([, v]) => v && v.length);
    if (first && e.code === "VALIDATION_ERROR") return `${prettyField(first[0])}: ${first[1]![0]}`;
    return e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

function prettyField(f: string) {
  const last = f.split(".").pop() ?? f;
  return last.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
