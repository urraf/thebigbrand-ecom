"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { BookingView } from "@/server/ads/booking";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, loadRazorpay, type ApiError } from "./booking";
import { dLabel, fmt, nf } from "./shared";

const STATUS: Record<string, [string, string]> = {
  PENDING_REVIEW: ["In review", "is-review"],
  APPROVED: ["Approved", "is-live"],
  PAUSED: ["Paused", ""],
  REJECTED: ["Not approved", "is-bad"],
  ENDED: ["Ended", ""],
  DRAFT: ["Draft", ""],
};

function statusOf(c: BookingView, today: string): [string, string] {
  if (c.status === "APPROVED") {
    if (c.startDate > today) return ["Approved · starts soon", "is-live"];
    if (c.endDate < today) return ["Ended", ""];
    return ["Live", "is-live"];
  }
  return STATUS[c.status] ?? [c.status, ""];
}

/** The signed-in advertiser's bookings (GET /api/v1/ads/book) with status, payment and delivery. */
export function MyCampaigns() {
  const [list, setList] = useState<BookingView[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState("");
  const today = useSyncExternalStore(
    () => () => {},
    () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10),
    () => "",
  );

  const load = useCallback(async () => {
    try {
      // signed-out visitors: show the sign-in prompt without a 401 round-trip
      const me = await api<{ user: unknown }>("/api/v1/auth/me").catch(() => ({ user: null }));
      if (!me?.user) {
        setNeedLogin(true);
        setList([]);
        return;
      }
      setList(await api<BookingView[]>("/api/v1/ads/book"));
    } catch (x) {
      if ((x as ApiError).status === 401) setNeedLogin(true);
      else toast((x as ApiError).message, { icon: "info" });
      setList([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const verify = async (code: string, body: Record<string, unknown>) => {
    setBusy(code);
    try {
      await api<BookingView>(`/api/v1/ads/book/${encodeURIComponent(code)}/pay/verify`, { method: "POST", body: JSON.stringify(body) });
      toast(`Paid — ${code} is with our team for review`, { icon: "check" });
    } catch (x) {
      toast((x as ApiError).message, { icon: "info" });
    } finally {
      setBusy("");
      void load();
    }
  };

  const pay = async (c: BookingView, outcome: "success" | "failure" = "success") => {
    setBusy(c.code);
    try {
      const v = await api<BookingView>(`/api/v1/ads/book/${encodeURIComponent(c.code)}/pay`, { method: "POST" });
      const p = v.payment;
      if (!p) throw { status: 409, message: "No payment is due for this campaign" };
      if (p.mode === "TEST") return void (await verify(c.code, { test: true, outcome }));
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) throw { status: 0, message: "Couldn't load the payment window" };
      setBusy("");
      new window.Razorpay({
        key: p.keyId,
        amount: Math.round(p.amount * 100),
        currency: p.currency,
        order_id: p.providerOrderId,
        name: "The Big Brands · Ads",
        description: `${c.code} · ${c.slot.name}`,
        theme: { color: "#ff3d6e" },
        handler: (r: Record<string, string>) => void verify(c.code, { razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }),
      }).open();
    } catch (x) {
      toast((x as ApiError).message, { icon: "info" });
      setBusy("");
    }
  };

  return (
    <>
      <div className="avc-h">
        <div>
          <h1>My ad campaigns</h1>
          <p>Review status, payments and live delivery for everything you&rsquo;ve booked.</p>
        </div>
        <Link className="btn btn-cart" href="/advertise#av-book">
          <Icon name="plus" />
          Book a campaign
        </Link>
      </div>
      {needLogin ? (
        <div className="avc-empty">
          <Icon name="user" />
          <h2>Sign in to see your campaigns</h2>
          <p>Use the account you booked with. Campaigns appear here as soon as they&rsquo;re booked.</p>
          <Link className="btn btn-dark" href={`/login?next=${encodeURIComponent("/advertise/campaigns")}`}>
            Sign in
          </Link>
        </div>
      ) : list === null ? (
        <div className="avc-empty" aria-busy="true">
          <p>Loading your campaigns…</p>
        </div>
      ) : !list.length ? (
        <div className="avc-empty">
          <Icon name="megaphone" />
          <h2>No campaigns yet</h2>
          <p>Book a billboard, a search banner or a deal of the day — it takes five minutes and we review every ad within 24 hours.</p>
          <Link className="btn btn-cart" href="/advertise#av-book">
            Book your first campaign
          </Link>
        </div>
      ) : (
        <div className="avc-list">
          {list.map((c) => {
            const [label, cls] = statusOf(c, today);
            const unpaid = c.paymentStatus !== "PAID" && c.paymentStatus !== "WAIVED" && c.status !== "REJECTED" && c.status !== "ENDED";
            const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
            return (
              <article key={c.code} className="avc-c">
                <div className="avc-t">
                  <div className="avc-t-top">
                    <span className="av-id">{c.slot.code}</span>
                    <span className={`avc-st ${cls}`}>{label}</span>
                    {unpaid ? <span className="avc-st is-unpaid">Payment due</span> : null}
                    <small>{c.code}</small>
                  </div>
                  <h2>{c.headline}</h2>
                  <small>
                    {c.brand?.name ?? ""} · {c.slot.name} · {dLabel(c.startDate)} → {dLabel(c.endDate)}
                  </small>
                </div>
                <div className="avc-k">
                  <div>
                    <small>Impressions</small>
                    <b>{nf(c.impressions)}</b>
                  </div>
                  <div>
                    <small>Clicks</small>
                    <b>{nf(c.clicks)}</b>
                  </div>
                  <div>
                    <small>CTR</small>
                    <b>{ctr.toFixed(1)}%</b>
                  </div>
                  <div>
                    <small>Spent</small>
                    <b>{fmt(c.spent)}</b>
                  </div>
                </div>
                <div className="avc-a">
                  {unpaid ? (
                    <button type="button" className="btn btn-cart btn-sm" disabled={busy === c.code} aria-busy={(busy === c.code) || undefined} onClick={() => void pay(c)}>
                      {busy === c.code ? "Processing…" : `Pay ${fmt(c.quote?.total ?? c.payment?.amount ?? 0)}`}
                    </button>
                  ) : null}
                  <small>
                    {c.quote ? `${fmt(c.quote.total)} incl. GST` : ""}
                    {c.status === "PENDING_REVIEW" && !unpaid ? " · reviewed within 24 h" : ""}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
