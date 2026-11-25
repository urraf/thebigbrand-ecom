import Link from "next/link";
import { Suspense } from "react";
import { AuditQuery, entityHref, listAudit } from "@/server/admin/core/audit-log";
import { requireSuperAdminPage } from "@/server/admin/core/guard";
import { Card, EmptyState, PageHeader, Pagination, SkeletonTable, Toolbar, fmtDateTime, flatParams, type SearchParamsInput } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

const VERB: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  approve: "approved",
  reject: "rejected",
  archive: "archived",
  publish: "published",
  hide: "hid",
  show: "showed",
  enable: "enabled",
  disable: "disabled",
  restock: "restocked",
  tiers: "changed gift tiers",
  note: "added a note to",
  refund: "recorded a refund for",
  commission: "changed the commission for",
  suspend: "suspended",
  reactivate: "reactivated",
  apply: "applied as",
  pay: "paid for",
  book: "booked",
  payment_failed: "had a failed payment for",
  paid: "marked paid",
  processing: "started processing",
  adjust: "adjusted",
  store_on: "switched on the brand store for",
  store_off: "switched off the brand store for",
  confirmed: "confirmed",
  packed: "packed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  returned: "marked returned",
  pause: "paused",
  resume: "resumed",
  // product status changes from the editor (product.<status>)
  active: "set live",
  draft: "moved to draft",
  pending: "sent for approval",
  rejected: "rejected",
  archived: "archived",
};

const ENTITY: Record<string, string> = {
  AdCampaign: "campaign",
  AdSlot: "ad slot",
  SellerLedgerEntry: "ledger entry",
  GiftItem: "gift",
  GiftTier: "",
  User: "customer",
  Setting: "settings",
  OrderItem: "order item",
};
const entityWord = (e: string) => ENTITY[e] ?? e.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

function describe(action: string): string {
  const parts = action.split(".");
  const last = parts[parts.length - 1];
  return VERB[last] ?? last.replace(/_/g, " ").toLowerCase();
}

function label(entity: string, id: string | null, data: unknown): string | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const v = d.number ?? d.name ?? d.code ?? d.miniName ?? d.displayName ?? d.businessName ?? d.headline ?? d.product ?? d.seller;
  if (typeof v === "string" && v) return v;
  if (entity === "Setting") return id;
  return id ? `#${id.slice(-6)}` : null;
}

async function Audit({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireSuperAdminPage("/admin/audit");
  const params = flatParams(await searchParams);
  const parsed = AuditQuery.safeParse(params);
  const q = parsed.success ? parsed.data : AuditQuery.parse({});
  const list = await listAudit(q);
  return (
    <Card title="Activity" sub={`${list.total.toLocaleString("en-IN")} recorded actions by the team and sellers`} id="am-audit">
      <Toolbar
        search={{ placeholder: "Action, record id or person…" }}
        filters={[
          { param: "entity", label: "Record type", allLabel: "All records", options: list.facets.entities.map((e) => ({ value: e.entity, label: `${e.entity} (${e.count})` })) },
          { param: "actor", label: "Person", allLabel: "Everyone", options: list.facets.actors.map((a) => ({ value: a.id, label: `${a.name} · ${a.role.toLowerCase()}` })) },
        ]}
        dateRange={{ from: "from", to: "to" }}
      />
      {list.items.length ? (
        <ol className="am-audit">
          {list.items.map((r) => {
            const href = entityHref(r.entity, r.entityId, r.data);
            const name = label(r.entity, r.entityId, r.data);
            return (
              <li key={r.id}>
                <span className="am-audit-t">{fmtDateTime(r.createdAt)}</span>
                <div className="am-audit-b">
                  <p>
                    <b>{r.actor?.name ?? r.actor?.email ?? "System"}</b> {describe(r.action)}{" "}
                    {entityWord(r.entity) ? <span className="am-muted">{entityWord(r.entity)} </span> : null}
                    {name ? href ? <Link href={href} className="link">{name}</Link> : <b>{name}</b> : null}
                  </p>
                  <details>
                    <summary>
                      <code>{r.action}</code>
                      {r.entityId ? <span className="am-muted"> · {r.entityId}</span> : null}
                    </summary>
                    <pre>{JSON.stringify(r.data, null, 2)}</pre>
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState icon="shield" title="No activity matches">
          Actions like approving products, shipping orders and changing gift rules are recorded here.
        </EmptyState>
      )}
      <Pagination basePath="/admin/audit" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="actions" />
    </Card>
  );
}

export default function AuditPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Audit log" sub="Every change made from the admin console and seller portal — who, what and when." />
      <Suspense fallback={<SkeletonTable rows={12} />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </>
  );
}
