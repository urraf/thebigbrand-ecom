import { Suspense } from "react";
import { db } from "@/lib/db";
import { getSettings, integrationStatus } from "@/server/admin/core/settings";
import { requireSuperAdminPage } from "@/server/admin/core/guard";
import { ShippingForm, StoreForm, TrendingForm } from "@/components/admin/core/settings-forms";
import { Card, KeyValues, PageHeader, Pill, SkeletonTable, avatarTint, fmtAgo, fmtDateTime, initials } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

async function Settings() {
  await requireSuperAdminPage("/admin/settings");
  const [s, team] = await Promise.all([
    getSettings(),
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: { role: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } }),
  ]);
  const i = integrationStatus();
  const now = new Date().toISOString();
  return (
    <div className="am-set">
      <Card title="Store details" sub={`Shown on invoices and the website footer${s.updatedAt.store ? ` · updated ${fmtDateTime(s.updatedAt.store)}` : ""}`} id="am-set-store">
        <StoreForm initial={s.store} />
      </Card>
      <Card title="Shipping & cash on delivery" sub="Used by the cart and checkout to calculate every order" id="am-set-ship">
        <ShippingForm initial={s.shipping} />
      </Card>
      <Card
        title="Payment gateway"
        sub="UPI, cards, net banking, wallets & COD · configured with server environment variables"
        actions={i.gateway.mode === "RAZORPAY" ? <Pill tone="live">{i.gateway.live ? "Razorpay · live" : "Razorpay · test keys"}</Pill> : <Pill tone="pending">Test gateway</Pill>}
        id="am-set-pay"
      >
        <KeyValues
          rows={[
            ["Provider", i.gateway.mode === "RAZORPAY" ? "Razorpay Checkout" : "Built-in test gateway (no real money)"],
            ["Key ID", i.gateway.keyId ? <code key="k">{i.gateway.keyId}</code> : "Not set — add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET"],
            ["Webhook", i.gateway.webhookConfigured ? <span className="am-ok-t" key="w">Configured</span> : "Not configured — set RAZORPAY_WEBHOOK_SECRET"],
            ["Cash on delivery", s.shipping.codEnabled ? "Enabled" : "Disabled"],
          ]}
        />
        <p className="am-set-note">Secrets are never shown here. Change them in the hosting dashboard and redeploy.</p>
      </Card>
      <Card title="Integrations" sub="Read-only status" id="am-set-int">
        <KeyValues
          rows={[
            ["OTP / SMS", i.sms.enabled ? "MSG91" : i.sms.devOtp ? "Dev mode — OTP shown on screen" : "Not configured"],
            ["File storage", i.storage.driver === "blob" ? (i.storage.configured ? "Vercel Blob" : "Vercel Blob — token missing") : "Local disk (/public/uploads)"],
            ["Site URL", i.appUrl],
          ]}
        />
      </Card>
      <Card title="Trending searches" sub="Suggestions in the search box on the website & app" id="am-set-trend">
        <TrendingForm initial={s.trending} />
      </Card>
      <Card title="Team" sub="Who can use this console & the admin app" id="am-set-team">
        <ul className="am-team">
          {team.map((u) => (
            <li key={u.id}>
              <span className="am-cav" style={{ background: avatarTint(u.name ?? u.email) }} aria-hidden="true">
                {initials(u.name ?? u.email)}
              </span>
              <span>
                <b>{u.name ?? u.email}</b>
                <small>
                  {u.role === "ADMIN" ? "Owner · full access" : "Staff · orders, catalogue, approvals (no settings or audit log)"}
                  {u.lastLoginAt ? ` · active ${fmtAgo(u.lastLoginAt, now)}` : ""}
                </small>
              </span>
              {!u.isActive ? <Pill tone="rejected">Disabled</Pill> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" sub="Store details, shipping & COD, payments, search and team." />
      <Suspense fallback={<SkeletonTable rows={10} />}>
        <Settings />
      </Suspense>
    </>
  );
}
