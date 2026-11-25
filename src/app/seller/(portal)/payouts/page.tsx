import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import type { LedgerType } from "@/lib/db";
import { requireSellerPage } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { BodySkeleton, PageHead, Pill } from "@/components/seller/page-head";
import { LEDGER_LABEL, PAYOUT_LABEL, STATUS_TONE, fmtDate, fmtDay, fmtShort, inr, plural, signedINR, utr } from "@/components/seller/format";
import { maskAccount } from "@/components/seller/kyc";
import { LEDGER_TYPES, getSellerBalance, listLedger, listPayouts } from "@/server/seller/ledger";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Payouts & ledger" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function PayoutsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead title="Payouts & ledger" sub="Every rupee in and out of your seller account. Payouts go to your bank every Wednesday." />
      <Suspense fallback={<BodySkeleton rows={[130, 420]} />}>
        <PayoutsBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const TYPE_TONE: Record<LedgerType, string> = {
  SALE_CREDIT: "ok",
  COMMISSION_DEBIT: "off",
  REFUND_DEBIT: "crit",
  PAYOUT: "shipped",
  AD_SPEND: "new",
  ADJUSTMENT: "pending",
};

async function PayoutsBody({ searchParams }: { searchParams: SP }) {
  const { seller } = await requireSellerPage("/seller/payouts");
  const sp = await searchParams;
  const type = (LEDGER_TYPES as string[]).includes(one(sp.type)) ? (one(sp.type) as LedgerType) : undefined;
  const from = isDay(one(sp.from)) ? one(sp.from) : "";
  const to = isDay(one(sp.to)) ? one(sp.to) : "";
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  const [bal, ledger, payouts, href] = await Promise.all([
    getSellerBalance(seller.id),
    listLedger(seller.id, { type, from, to, page, limit: 25 }),
    listPayouts(seller.id, { limit: 12 }),
    getSellerHref(),
  ]);
  const filters = new URLSearchParams();
  if (type) filters.set("type", type);
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);
  const csvHref = `/api/v1/seller/ledger?format=csv${filters.size ? `&${filters}` : ""}`;
  const pageHref = (n: number) => {
    const p = new URLSearchParams(filters);
    if (n > 1) p.set("page", String(n));
    return href(`/seller/payouts${p.size ? `?${p}` : ""}`);
  };
  const filtered = !!(type || from || to);
  const sales = ledger.totals.SALE_CREDIT?.amount ?? 0;
  const commission = ledger.totals.COMMISSION_DEBIT?.amount ?? 0;

  return (
    <div className="sl-body">
      <section className="sl-bal" aria-label="Balance">
        <div className="sl-bal-hero">
          <small>Available balance</small>
          <b>{inr(bal.balance)}</b>
          <span>
            <Icon name="calendar" /> Next payout {fmtDay(bal.nextPayoutAt)} to {seller.bankIfsc ? `${seller.bankIfsc.slice(0, 4)} ${maskAccount(seller.bankAccountNumber)}` : "your bank account"}
          </span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="truck" /> On the way
          </span>
          <span className="sl-kpi-v">{formatINR(bal.pendingEarnings)}</span>
          <span className="sl-kpi-s">{plural(bal.pendingItems, "item")} not yet delivered — credited on delivery</span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="card" /> Paid to date
          </span>
          <span className="sl-kpi-v">{formatINR(bal.totalPaidOut)}</span>
          <span className="sl-kpi-s">{plural(bal.payoutCount, "payout")}</span>
        </div>
        <div className="sl-kpi">
          <span className="sl-kpi-l">
            <Icon name="percent" /> Commission rate
          </span>
          <span className="sl-kpi-v">{seller.commissionPct}%</span>
          <span className="sl-kpi-s">of the selling price, deducted when an item is delivered</span>
        </div>
      </section>

      <div className="sl-grid">
        <section className="sl-card sl-span8" aria-labelledby="ledger-h">
          <div className="sl-card-h">
            <div>
              <h2 id="ledger-h">Ledger</h2>
              <p>
                {filtered ? "Filtered" : "All entries"} · {plural(ledger.total, "entry", "entries")} · net <b>{signedINR(ledger.net)}</b>
                {sales ? (
                  <>
                    {" "}· sales {formatINR(sales)}, commission {formatINR(Math.abs(commission))}
                  </>
                ) : null}
              </p>
            </div>
            <a href={csvHref} className="btn btn-ghost btn-sm" download>
              <Icon name="upload" style={{ transform: "rotate(180deg)" }} /> Download CSV
            </a>
          </div>
          <Form className="sl-filters" action={href("/seller/payouts")} style={{ marginBottom: 14 }}>
            <select name="type" defaultValue={type ?? ""} className="sl-select" aria-label="Entry type">
              <option value="">All types</option>
              {LEDGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEDGER_LABEL[t]}
                </option>
              ))}
            </select>
            <label className="sl-date">
              From <input type="date" name="from" defaultValue={from} />
            </label>
            <label className="sl-date">
              To <input type="date" name="to" defaultValue={to} />
            </label>
            <button type="submit" className="btn btn-dark btn-sm">
              Apply
            </button>
            {filtered ? (
              <Link href={href("/seller/payouts")} className="btn btn-ghost btn-sm">
                Clear
              </Link>
            ) : null}
          </Form>
          {ledger.items.length ? (
            <div className="sl-tscroll sl-tstack">
              <table className="sl-table sl-stack sl-stack-led">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th className="r">Amount</th>
                    {!filtered ? <th className="r">Balance</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap">{fmtShort(e.createdAt)}</td>
                      <td>
                        <Pill tone={TYPE_TONE[e.type]}>{e.label}</Pill>
                      </td>
                      <td className="sl-x-full">
                        {e.productName ?? (e.type === "PAYOUT" ? "Bank payout" : e.note ?? "—")}
                        <span className="sl-sub">
                          {e.orderNumber ? (
                            <Link className="link" href={href(`/seller/orders/${e.orderNumber}`)} style={{ fontSize: 12 }}>
                              {e.orderNumber}
                            </Link>
                          ) : null}
                          {e.type === "PAYOUT" ? utr(e.payoutRef) || e.note : null}
                          {e.type === "COMMISSION_DEBIT" && e.note ? ` · ${e.note.split(" · ")[0]}` : null}
                          {(e.type === "ADJUSTMENT" || e.type === "AD_SPEND") && e.productName && e.note ? e.note : null}
                        </span>
                      </td>
                      <td className="r num">
                        <span className={e.amount > 0 ? "sl-amt-pos" : "sl-amt-neg"}>{signedINR(e.amount)}</span>
                      </td>
                      {!filtered ? (
                        <td className="r num" data-l="Balance">
                          {e.balanceAfter !== null ? inr(e.balanceAfter) : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sl-empty">
              <Icon name="card" />
              <b>{filtered ? "No entries for these filters" : "No money movements yet"}</b>
              <p>Sales are credited here (minus commission) as soon as each item is delivered.</p>
            </div>
          )}
          {ledger.pages > 1 ? (
            <div className="sl-pager">
              <span>
                Page {ledger.page} of {ledger.pages}
              </span>
              <div>
                {ledger.page > 1 ? (
                  <Link className="btn btn-ghost btn-sm" href={pageHref(ledger.page - 1)}>
                    <Icon name="chevLeft" /> Newer
                  </Link>
                ) : null}
                {ledger.page < ledger.pages ? (
                  <Link className="btn btn-ghost btn-sm" href={pageHref(ledger.page + 1)}>
                    Older <Icon name="chevRight" />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <div className="sl-span4" style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="sl-card" aria-labelledby="payouts-h">
            <div className="sl-card-h">
              <div>
                <h2 id="payouts-h">Payouts</h2>
                <p>Bank transfers to your account</p>
              </div>
            </div>
            {payouts.items.length ? (
              <ul className="sl-att">
                {payouts.items.map((p) => (
                  <li key={p.id} className={p.status === "PAID" ? "sl-att-ok" : p.status === "FAILED" ? "sl-att-crit" : "sl-att-gold"}>
                    <span className="sl-att-ic">
                      <Icon name={p.status === "PAID" ? "check" : p.status === "FAILED" ? "info" : "clock"} />
                    </span>
                    <span className="sl-att-t">
                      <b className="num">{formatINR(p.amount)}</b>
                      <small>
                        {p.paidAt ? `Paid ${fmtDate(p.paidAt)}` : `Created ${fmtDate(p.createdAt)}`}
                        {p.reference ? ` · ${utr(p.reference)}` : ""}
                        {p.periodStart && p.periodEnd ? ` · for ${fmtShort(p.periodStart)}–${fmtShort(p.periodEnd)}` : ""}
                      </small>
                    </span>
                    <Pill tone={STATUS_TONE[p.status]}>{PAYOUT_LABEL[p.status]}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sl-empty" style={{ padding: "24px 8px" }}>
                <Icon name="calendar" />
                <b>First payout {fmtDay(bal.nextPayoutAt)}</b>
                <p>Once you have a positive balance from delivered orders, it&apos;s sent automatically.</p>
              </div>
            )}
          </section>
          <section className="sl-card" aria-labelledby="how-h">
            <div className="sl-card-h">
              <div>
                <h2 id="how-h">How payouts work</h2>
              </div>
            </div>
            <ul className="sl-att">
              <li className="sl-att-violet">
                <span className="sl-att-ic">
                  <Icon name="box" />
                </span>
                <span className="sl-att-t">
                  <b>Item delivered</b>
                  <small>Sale credited, {seller.commissionPct}% commission deducted</small>
                </span>
                <span />
              </li>
              <li className="sl-att-gold">
                <span className="sl-att-ic">
                  <Icon name="calendar" />
                </span>
                <span className="sl-att-t">
                  <b>Every Wednesday</b>
                  <small>Your available balance is transferred by NEFT/IMPS</small>
                </span>
                <span />
              </li>
              <li className="sl-att-coral">
                <span className="sl-att-ic">
                  <Icon name="ret" />
                </span>
                <span className="sl-att-t">
                  <b>Returns</b>
                  <small>Your earning on a returned item is reversed</small>
                </span>
                <span />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
