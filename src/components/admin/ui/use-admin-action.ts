"use client";
/**
 * Client helpers for calling the admin REST API (/api/v1/admin/**) from interactive islands.
 *
 *   const { run, busy } = useAdminAction();
 *   await run("/api/v1/admin/products/123", { method: "PATCH", body: { stock: 10 } }, { success: "Stock updated" });
 *
 * - Shows a toast on success/failure, then `router.refresh()` so Server Components re-read the database.
 * - Returns the `data` payload, or `null` when the request failed (the error toast is already shown).
 * - Validation errors (400 VALIDATION_ERROR) are returned on `lastError.fields` for inline form errors.
 */
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import type { IconName } from "@/components/ui/icon";

export type ApiFailure = { status: number; code: string; message: string; fields: Record<string, string> };

export class AdminApiError extends Error {
  constructor(public failure: ApiFailure) {
    super(failure.message);
  }
}

type Json = Record<string, unknown> | unknown[] | null;

/** fetch wrapper: JSON in/out, throws AdminApiError with field errors on failure. */
export async function adminFetch<T = unknown>(url: string, init: { method?: string; body?: Json | FormData } = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: isForm || init.body == null ? undefined : { "content-type": "application/json" },
      body: isForm ? (init.body as FormData) : init.body == null ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError({ status: 0, code: "NETWORK", message: "Network error — check your connection and try again", fields: {} });
  }
  let json: { data?: T; error?: { code: string; message: string; details?: unknown } } = {};
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok || json.error) {
    const e = json.error ?? { code: "HTTP_" + res.status, message: res.status === 401 ? "Your session expired — please sign in again" : "Something went wrong" };
    throw new AdminApiError({ status: res.status, code: e.code, message: e.message, fields: fieldErrors(e.details) });
  }
  return json.data as T;
}

/** zod `flattenError` details → { field: "first message" } */
export function fieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const d = details as { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] } | undefined;
  if (d && typeof d === "object" && d.fieldErrors) {
    for (const [k, v] of Object.entries(d.fieldErrors)) if (v && v[0]) out[k] = v[0];
  }
  if (d && typeof d === "object" && !d.fieldErrors && !Array.isArray(d)) {
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

export type RunOptions = {
  /** toast on success (string or fn of the response data); omit for silent success */
  success?: string | ((data: unknown) => string);
  icon?: IconName;
  /** re-read Server Components afterwards (default true) */
  refresh?: boolean;
  /** navigate after success */
  redirect?: string | ((data: unknown) => string);
  /** suppress the error toast (caller renders it inline) */
  quietError?: boolean;
};

export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lastError, setLastError] = useState<ApiFailure | null>(null);

  const run = useCallback(
    async <T = unknown>(url: string, init: { method?: string; body?: Json | FormData } = {}, opts: RunOptions = {}): Promise<T | null> => {
      setBusy(true);
      setLastError(null);
      try {
        const data = await adminFetch<T>(url, init);
        if (opts.success) toast(typeof opts.success === "function" ? opts.success(data) : opts.success, { icon: opts.icon ?? "check" });
        const to = typeof opts.redirect === "function" ? opts.redirect(data) : opts.redirect;
        startTransition(() => {
          if (to) router.push(to);
          else if (opts.refresh !== false) router.refresh();
        });
        return (data ?? ({} as T)) as T;
      } catch (e) {
        const failure =
          e instanceof AdminApiError ? e.failure : { status: 0, code: "UNKNOWN", message: "Something went wrong", fields: {} };
        setLastError(failure);
        if (!opts.quietError) toast(failure.message, { icon: "info", duration: 4200 });
        if (failure.status === 401) router.push(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { run, busy: busy || pending, lastError, clearError: () => setLastError(null) };
}
