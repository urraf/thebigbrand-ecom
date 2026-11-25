import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { getCustomer } from "@/server/admin/core/customers";
import { GiftChips, PAYMENT_SHORT } from "@/components/admin/core/bits";
import { Card, ConfirmButton, DataTable, EmptyState, KeyValues, PageHeader, Pill, SkeletonTable, StatCard, StatGrid, StatusPill, avatarTint, fmtDate, fmtDateTime, initials } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Customer" };

async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/customers/${id}`);
  const c = await getCustomer(id);
  if (!c) notFound();
  const name = c.name || c.email || (c.phone ? `+91 ${c.phone}` : "Customer");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={
          <span className="am-custh">
            <span className="am-cav am-cav-lg" style={{ background: avatarTint(name) }} aria-hidden="true">
              {initials(name)}
            </span>
            {name}
          </span>
        }
        badge={c.isActive ? <Pill tone="live">Active</Pill> : <Pill tone="rejected">Disabled</Pill>}
        sub={`Customer since ${fmtDate(c.createdAt)}${c.lastLoginAt ? ` · last signed in ${fmtDateTime(c.lastLoginAt)}` : ""}`}
        actions={
          c.isActive ? (
            <ConfirmButton
              url={`/api/v1/admin/customers/${c.id}`}
              method="PATCH"
              body={{ isActive: false }}
              className="btn btn-ghost btn-sm"
              confirm={`Disable ${name}'s account?`}
              message="They're signed out on every device and can't sign in or place orders until you re-enable the account. Existing orders are not affected."
              confirmLabel="Disable account"
              tone="danger"
              reason={{ label: "Internal reason", field: "reason", placeholder: "Repeated COD refusals / fraud check…" }}
              success="Account disabled — signed out everywhere"
              icon="shield"
            >
              <Icon name="shield" />
              Disable account
            </ConfirmButton>
          ) : (
            <ConfirmButton
              url={`/api/v1/admin/customers/${c.id}`}
              method="PATCH"
              body={{ isActive: true }}
              className="btn btn-dark btn-sm"
              confirm={`Re-enable ${name}'s account?`}
              message="They can sign in and order again."
              confirmLabel="Enable account"
              tone="ok"
              success="Account enabled"
              icon="check"
            >
              <Icon name="check" />
              Enable account
            </ConfirmButton>
          )
        }
      />
      <StatGrid label="Customer stats">
        <StatCard label="Total spent" value={formatINR(c.stats.spent)} sub={`${c.stats.paidOrders} completed order${c.stats.paidOrders === 1 ? "" : "s"}`} />
        <StatCard label="Average order" value={formatINR(c.stats.aov)} sub={c.stats.firstOrderAt ? `first order ${fmtDate(c.stats.firstOrderAt)}` : "No orders yet"} />
        <StatCard label="Free gifts received" value={c.stats.giftsReceived} sub="TBB Originals minis" />
        <StatCard label="Engagement" value={c.stats.wishlist} unit=" saved" sub={`${c.stats.reviews} reviews · ${c.stats.couponUses} coupons used`} />
      </StatGrid>
      <div className="am-grid">
        <Card className="am-span8" title="Orders" sub={`${c.stats.orders} order${c.stats.orders === 1 ? "" : "s"}${c.stats.orders > c.orders.length ? ` · latest ${c.orders.length} shown` : ""}`} id="am-corders" actions={c.phone ? <Link className="link" href={`/admin/orders?q=${c.phone}`}>All orders <Icon name="chevRight" /></Link> : undefined}>
          <DataTable
            small
            rows={c.orders}
            rowKey={(o) => o.id}
            empty={<EmptyState icon="box" title="No orders yet" />}
            columns={[
              {
                key: "n",
                label: "Order",
                main: true,
                render: (o) => (
                  <>
                    <Link className="am-oid am-rowlink" href={`/admin/orders/${o.number}`}>
                      {o.number}
                    </Link>
                    <small className="am-sub">
                      {fmtDateTime(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                    </small>
                  </>
                ),
              },
              { key: "g", label: "Free gifts", render: (o) => <GiftChips gifts={o.gifts} compact /> },
              {
                key: "t",
                label: "Amount",
                align: "right",
                render: (o) => (
                  <>
                    <b className="num">{formatINR(o.total)}</b>
                    <small className="am-sub">{PAYMENT_SHORT[o.paymentMethod]}</small>
                  </>
                ),
              },
              { key: "s", label: "Status", render: (o) => <StatusPill kind="order" status={o.status} /> },
            ]}
          />
        </Card>
        <div className="am-span4 am-col-stack">
          <Card title="Contact" id="am-contact">
            <KeyValues
              rows={[
                ["Mobile", c.phone ? <a href={`tel:+91${c.phone}`}>+91 {c.phone}</a> : "—"],
                ["Email", c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"],
                ["Account type", c.role === "SELLER" ? "Seller (also shops)" : "Customer"],
                ["Signed-in devices", c.stats.activeSessions],
              ]}
            />
          </Card>
          <Card title="Addresses" sub={`${c.addresses.length} saved`} id="am-addrs">
            {c.addresses.length ? (
              <ul className="am-addrs">
                {c.addresses.map((a) => (
                  <li key={a.id}>
                    <address className="am-addr">
                      <b>
                        {a.name} {a.label ? <span className="am-tag">{a.label}</span> : null} {a.isDefault ? <span className="am-tag am-tag-violet">Default</span> : null}
                      </b>
                      <span>
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                      </span>
                      {a.landmark ? <span>Near {a.landmark}</span> : null}
                      <span>
                        {a.city}, {a.state} {a.pincode}
                      </span>
                      <span>+91 {a.phone}</span>
                    </address>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="am-muted">No saved addresses.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader back={{ href: "/admin/customers", label: "Customers" }} title="Customer" sub="Loading…" />
          <SkeletonTable rows={6} />
        </>
      }
    >
      <Customer params={params} />
    </Suspense>
  );
}
