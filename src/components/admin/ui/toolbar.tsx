"use client";
/**
 * Toolbar — URL-driven filters for list pages. Changing a control updates the query string (resetting ?page)
 * and the Server Component re-renders with the new filters. Search is debounced.
 *
 *   <Toolbar
 *     search={{ param: "q", placeholder: "Search orders, customers, phone…" }}
 *     filters={[{ param: "status", label: "Status", options: [{ value: "PLACED", label: "New" }, …] }]}
 *     dateRange={{ from: "from", to: "to" }}
 *   >{extra buttons}</Toolbar>
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export type ToolbarFilter = {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** label of the empty option (default "All <label>") */
  allLabel?: string;
};

export function Toolbar({
  search,
  filters = [],
  dateRange,
  children,
}: {
  search?: { param?: string; placeholder?: string };
  filters?: ToolbarFilter[];
  dateRange?: { from: string; to: string; label?: string };
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const qParam = search?.param ?? "q";
  const [q, setQ] = useState(sp.get(qParam) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPushed = useRef(sp.get(qParam) ?? "");

  // keep the box in sync when navigation changes the URL (e.g. "Clear filters")
  const urlQ = sp.get(qParam) ?? "";
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      lastPushed.current = urlQ;
      setQ(urlQ);
    }
  }, [urlQ]);

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onQ(v: string) {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastPushed.current = v.trim();
      push({ [qParam]: v.trim() || null });
    }, 350);
  }

  const keys = [qParam, ...filters.map((f) => f.param), ...(dateRange ? [dateRange.from, dateRange.to] : [])];
  const active = keys.some((k) => sp.get(k));

  return (
    <div className="am-toolbar" aria-busy={pending || undefined}>
      {search ? (
        <form
          className="am-tb-q"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            clearTimeout(timer.current);
            lastPushed.current = q.trim();
            push({ [qParam]: q.trim() || null });
          }}
        >
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder={search.placeholder ?? "Search…"} aria-label={search.placeholder ?? "Search"} />
        </form>
      ) : null}
      {filters.map((f) => (
        <select key={f.param} value={sp.get(f.param) ?? ""} onChange={(e) => push({ [f.param]: e.target.value || null })} aria-label={f.label}>
          <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {dateRange ? (
        <>
          <label className="am-tb-l">
            {dateRange.label ?? "From"}
            <input type="date" value={sp.get(dateRange.from) ?? ""} onChange={(e) => push({ [dateRange.from]: e.target.value || null })} aria-label="From date" />
          </label>
          <label className="am-tb-l">
            to
            <input type="date" value={sp.get(dateRange.to) ?? ""} onChange={(e) => push({ [dateRange.to]: e.target.value || null })} aria-label="To date" />
          </label>
        </>
      ) : null}
      {active ? (
        <button
          type="button"
          className="am-tb-reset"
          onClick={() => {
            setQ("");
            lastPushed.current = "";
            push(Object.fromEntries(keys.map((k) => [k, null])));
          }}
        >
          Clear filters
        </button>
      ) : null}
      {children ? (
        <>
          <span className="am-tb-sp" />
          {children}
        </>
      ) : null}
    </div>
  );
}
