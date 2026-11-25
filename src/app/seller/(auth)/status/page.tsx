import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth } from "@/lib/auth";
import { site } from "@/lib/site";
import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";
import { SignOutButton } from "@/components/seller/sign-out-button";
import { StoreLink } from "@/components/seller/store-link";
import { fmtDate, fmtDayTime } from "@/components/seller/format";
import { getApplication } from "@/server/seller/apply";
import { getCategoryOptions } from "@/server/seller/options";
import { getSellerHref } from "@/server/seller/host";

export const metadata: Metadata = { title: "Application status" };

export default function SellerStatusPage() {
  return (
    <>
      <div className="sa-top">
        <StoreLink href="/" className="sa-back">
          <Icon name="chevLeft" /> Back to store
        </StoreLink>
        <span>
          Questions? <a href={`mailto:${site.sellerEmail}`}>{site.sellerEmail}</a>
        </span>
      </div>
      <div className="sa-body wide">
        <Suspense fallback={<div className="sa-status" aria-busy="true" style={{ minHeight: 380 }} />}>
          <StatusBody />
        </Suspense>
      </div>
    </>
  );
}

async function StatusBody() {
  const [auth, href] = await Promise.all([getAuth("seller"), getSellerHref()]);
  if (!auth) redirect(`${href("/seller/login")}?next=${encodeURIComponent(href("/seller/status"))}`);
  const app = await getApplication(auth.user.id);

  if (!app) {
    return (
      <div className="sa-status">
        <div className="sa-h">
          <h1>No application yet</h1>
          <p>
            You&apos;re signed in as <b>{auth.user.email ?? auth.user.phone}</b>, but this account hasn&apos;t applied to sell.
          </p>
        </div>
        <div className="sa-actions">
          <SLink href="/seller/register" className="btn btn-cart">
            Start your application <Icon name="arrow" />
          </SLink>
          <SignOutButton label="Use another account" />
        </div>
      </div>
    );
  }

  if (app.status === "APPROVED") {
    return (
      <div className="sa-status">
        <span className="sa-badge sa-badge-approved">
          <i aria-hidden="true" /> Approved
        </span>
        <div className="sa-h">
          <h1>You&apos;re approved, {app.displayName}!</h1>
          <p>Your seller account was approved on {fmtDate(app.approvedAt ?? app.updatedAt)}. List your first products — they go live after a quick check.</p>
        </div>
        <div className="sa-actions">
          <SLink href="/seller" className="btn btn-cart">
            Go to Seller Central <Icon name="arrow" />
          </SLink>
          <SLink href="/seller/products/new" className="btn btn-ghost">
            Add a product
          </SLink>
        </div>
      </div>
    );
  }

  const cats = await getCategoryOptions();
  const catName = (s: string) => cats.find((c) => c.slug === s)?.name ?? s;
  const summary = (
    <dl className="sa-sum">
      <dt>Legal name</dt>
      <dd>{app.businessName}</dd>
      <dt>Store name</dt>
      <dd>{app.displayName}</dd>
      <dt>GSTIN</dt>
      <dd>{app.form.gstin || "—"}</dd>
      <dt>Categories</dt>
      <dd>{app.form.categories.map(catName).join(", ") || "—"}</dd>
      <dt>Brands</dt>
      <dd>{app.form.brandsAuthorised.join(", ") || "—"}</dd>
      <dt>Contact</dt>
      <dd>
        {app.form.name} · {app.form.email}
      </dd>
    </dl>
  );

  if (app.status === "REJECTED") {
    return (
      <div className="sa-status">
        <span className="sa-badge sa-badge-rejected">
          <i aria-hidden="true" /> Changes needed
        </span>
        <div className="sa-h">
          <h1>We couldn&apos;t approve your application yet</h1>
          <p>Reviewed {fmtDayTime(app.updatedAt)}. Fix the points below and resubmit — it goes straight back into the review queue.</p>
        </div>
        <div className="sa-alert" role="note">
          <Icon name="info" />
          <span>
            <b>Reason:</b> {app.rejectionReason || "Some details couldn't be verified. Please re-check your GSTIN, PAN and bank details."}
          </span>
        </div>
        {summary}
        <div className="sa-actions">
          <SLink href="/seller/register" className="btn btn-cart">
            Edit &amp; resubmit <Icon name="arrow" />
          </SLink>
          <a className="btn btn-ghost" href={`mailto:${site.sellerEmail}?subject=${encodeURIComponent(`Seller application — ${app.displayName}`)}`}>
            Contact seller support
          </a>
          <SignOutButton />
        </div>
      </div>
    );
  }

  if (app.status === "SUSPENDED") {
    return (
      <div className="sa-status">
        <span className="sa-badge sa-badge-suspended">
          <i aria-hidden="true" /> Suspended
        </span>
        <div className="sa-h">
          <h1>Your seller account is on hold</h1>
          <p>Your listings are hidden and new orders are paused. This usually happens when documents expire or after repeated order issues. Our seller support team can help you get back up and running.</p>
        </div>
        {app.rejectionReason ? (
          <div className="sa-alert sa-alert-warn">
            <Icon name="info" />
            <span>{app.rejectionReason}</span>
          </div>
        ) : null}
        <div className="sa-actions">
          <a className="btn btn-cart" href={`mailto:${site.sellerEmail}?subject=${encodeURIComponent(`Account on hold — ${app.displayName}`)}`}>
            Email seller support
          </a>
          <a className="btn btn-ghost" href={`tel:${site.supportPhone.replace(/\s/g, "")}`}>
            Call {site.supportPhone}
          </a>
          <SignOutButton />
        </div>
      </div>
    );
  }

  // PENDING
  return (
    <div className="sa-status">
      <span className="sa-badge sa-badge-pending">
        <i aria-hidden="true" /> Under review
      </span>
      <div className="sa-h">
        <h1>Thanks, {app.form.name.split(" ")[0]} — we&apos;re reviewing {app.displayName}</h1>
        <p>
          Most applications are reviewed within 2 working days. This page updates the moment there&apos;s a decision — sign in any time to check. Our team may call <b>{app.form.mobile}</b> if something needs a quick fix.
        </p>
      </div>
      <ol className="sa-tl">
        <li className="done">
          <i aria-hidden="true">
            <Icon name="check" />
          </i>
          <span>
            <b>Application submitted</b>
            <small>{fmtDayTime(app.submittedAt)}</small>
          </span>
        </li>
        <li className="cur">
          <i aria-hidden="true">2</i>
          <span>
            <b>KYC &amp; document check</b>
            <small>We verify your GSTIN, PAN, bank account and brand authorisations.</small>
          </span>
        </li>
        <li>
          <i aria-hidden="true">3</i>
          <span>
            <b>Approval</b>
            <small>Your Seller Central dashboard unlocks.</small>
          </span>
        </li>
        <li>
          <i aria-hidden="true">4</i>
          <span>
            <b>List products &amp; start selling</b>
            <small>Add photos, price and stock. Each listing goes live after a quick authenticity check.</small>
          </span>
        </li>
      </ol>
      {summary}
      <div className="sa-actions">
        <SLink href="/seller/register" className="btn btn-ghost">
          <Icon name="sliders" /> Edit application
        </SLink>
        <StoreLink href="/sell" className="btn btn-ghost">
          Read the seller guide
        </StoreLink>
        <SignOutButton />
      </div>
    </div>
  );
}
