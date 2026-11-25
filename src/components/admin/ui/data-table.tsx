/**
 * DataTable — URL-driven table (sort + pagination are plain links, so it works from Server Components with
 * zero client JS). On phones (≤600px) rows become stacked cards: the `main` column spans the card, other
 * cells show their `label` above the value, `actions` columns become a button row.
 *
 *   <DataTable
 *     basePath="/admin/orders" params={params}            // current flat search params (flatParams())
 *     rows={items} rowKey={(o) => o.id}
 *     sort={{ by: params.sort, dir: params.dir }}          // optional, used to mark the active header
 *     columns={[
 *       { key: "number", label: "Order", main: true, render: (o) => <Link …>{o.number}</Link> },
 *       { key: "total", label: "Amount", align: "right", sortable: "total", render: (o) => formatINR(o.total) },
 *       { key: "act", label: "", actions: true, render: (o) => <ConfirmButton … /> },
 *     ]}
 *     empty={<EmptyState title="No orders" />}
 *   />
 *   <Pagination basePath="/admin/orders" params={params} page={1} pages={4} total={92} limit={24} />
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";
import { hrefWith } from "./format";

export type Column<T> = {
  key: string;
  label: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** sort key put in ?sort= when the header is clicked */
  sortable?: string;
  align?: "right" | "center";
  className?: string;
  /** spans the full card width on phones (title cell) */
  main?: boolean;
  /** button cell: becomes a full-width action row on phones */
  actions?: boolean;
  /** hide on phones */
  hideMobile?: boolean;
  /** label shown above the value on phones (defaults to `label` when it is a string) */
  mobileLabel?: string;
  width?: number | string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  basePath,
  params = {},
  sort,
  empty,
  className,
  rowClassName,
  small,
  stack = true,
  footer,
  minWidth,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  basePath?: string;
  params?: Record<string, string>;
  sort?: { by?: string; dir?: string };
  empty?: ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  small?: boolean;
  stack?: boolean;
  footer?: ReactNode;
  minWidth?: number;
  caption?: string;
}) {
  const by = sort?.by;
  const dir = sort?.dir === "asc" ? "asc" : "desc";
  return (
    <div className={cx("am-tscroll", stack && "am-tstack")}>
      <table className={cx("am-table am-dt", small && "am-table-sm", stack && "am-stack", className)} style={minWidth ? { minWidth } : undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => {
              const align = c.align === "right" ? "r" : c.align === "center" ? "c" : undefined;
              if (!c.sortable || !basePath) {
                return (
                  <th key={c.key} className={align} style={c.width ? { width: c.width } : undefined} scope="col">
                    {c.label === "" ? <span className="sr-only">Actions</span> : c.label}
                  </th>
                );
              }
              const on = by === c.sortable;
              const nextDir = on && dir === "desc" ? "asc" : "desc";
              return (
                <th
                  key={c.key}
                  className={align}
                  style={c.width ? { width: c.width } : undefined}
                  scope="col"
                  aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <Link href={hrefWith(basePath, params, { sort: c.sortable, dir: nextDir })} className={on ? "on" : undefined} scroll={false}>
                    {c.label}
                    <Icon name="chevDown" style={on && dir === "asc" ? { transform: "rotate(180deg)" } : undefined} />
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="am-dt-empty">
              <td colSpan={columns.length}>{empty ?? "Nothing to show yet."}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row, i)} className={rowClassName?.(row)}>
                {columns.map((c) => {
                  const ml = c.mobileLabel ?? (typeof c.label === "string" && c.label ? c.label : undefined);
                  return (
                    <td
                      key={c.key}
                      data-l={!c.main && !c.actions ? ml : undefined}
                      className={cx(
                        c.align === "right" && "r",
                        c.align === "center" && "c",
                        c.main && "am-c-main",
                        c.actions && "am-c-act",
                        c.hideMobile && "am-c-hide",
                        c.className,
                      )}
                    >
                      {c.render(row, i)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

export function Pagination({
  basePath,
  params,
  page,
  pages,
  total,
  limit,
  noun = "results",
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pages: number;
  total: number;
  limit: number;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const prev = page > 1 ? hrefWith(basePath, params, { page: page - 1 === 1 ? null : page - 1 }, true) : null;
  const next = page < pages ? hrefWith(basePath, params, { page: page + 1 }, true) : null;
  return (
    <nav className="am-pager" aria-label="Pagination">
      <span>
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} {noun}
      </span>
      <div>
        {pages > 1 ? <span>Page {page} of {pages}</span> : null}
        <Link className="btn btn-ghost btn-sm" href={prev ?? "#"} aria-disabled={!prev} tabIndex={prev ? undefined : -1} scroll={false}>
          <Icon name="chevLeft" />
          Previous
        </Link>
        <Link className="btn btn-ghost btn-sm" href={next ?? "#"} aria-disabled={!next} tabIndex={next ? undefined : -1} scroll={false}>
          Next
          <Icon name="chevRight" />
        </Link>
      </div>
    </nav>
  );
}

/** Link-based filter chips: <FilterChips basePath params param="status" options={[{value:"",label:"All",count:48}, …]} /> */
export function FilterChips({
  basePath,
  params,
  param,
  options,
  label,
}: {
  basePath: string;
  params: Record<string, string>;
  param: string;
  options: Array<{ value: string; label: string; count?: number }>;
  label: string;
}) {
  const cur = params[param] ?? "";
  return (
    <div className="am-chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = cur === o.value;
        return (
          <Link
            key={o.value || "all"}
            className={cx("chip", on && "on")}
            href={hrefWith(basePath, params, { [param]: o.value || null })}
            aria-current={on ? "true" : undefined}
            scroll={false}
          >
            {o.label}
            {o.count != null ? <span className="am-chip-n">{o.count.toLocaleString("en-IN")}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

/** Link tabs (page sections): <LinkTabs items={[{ href, label, active, count }]} /> */
export function LinkTabs({ items, label }: { items: Array<{ href: string; label: string; active: boolean; count?: number }>; label: string }) {
  return (
    <nav className="am-tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} scroll={false}>
          {t.label}
          {t.count != null ? <span className="am-chip-n">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
