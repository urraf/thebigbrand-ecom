import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSellerPage } from "@/lib/auth";
import { site } from "@/lib/site";
import { Icon } from "@/components/ui/icon";
import { BodySkeleton, PageHead } from "@/components/seller/page-head";
import { ProfileForm } from "@/components/seller/profile-form";
import { fmtDate } from "@/components/seller/format";
import { getCategoryOptions } from "@/server/seller/options";
import { toProfile } from "@/server/seller/profile";

export const metadata: Metadata = { title: "Business profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHead title="Business profile" sub="Your store details, pickup address and payout bank account." />
      <Suspense fallback={<BodySkeleton rows={[300, 260, 220]} />}>
        <ProfileBody />
      </Suspense>
    </>
  );
}

async function ProfileBody() {
  const { seller } = await requireSellerPage("/seller/profile");
  const [categories] = await Promise.all([getCategoryOptions()]);
  const p = toProfile(seller);
  return (
    <div className="sl-body">
      <div className="sl-grid">
        <div className="sl-span8">
          <ProfileForm
            profile={{
              displayName: p.displayName,
              description: p.description,
              logoUrl: p.logoUrl,
              categories: p.categories,
              contactName: p.contactName,
              email: p.email,
              phone: p.phone,
              addressLine: p.addressLine,
              city: p.city,
              state: p.state,
              pincode: p.pincode,
              bankAccountName: p.bankAccountName,
              bankAccountNumberMasked: p.bankAccountNumberMasked,
              bankIfsc: p.bankIfsc,
              upiId: p.upiId,
            }}
            categories={categories}
          />
        </div>
        <div className="sl-span4" style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="sl-card" aria-labelledby="legal-h">
            <div className="sl-card-h">
              <div>
                <h2 id="legal-h">Legal &amp; KYC</h2>
                <p>Verified when you were approved</p>
              </div>
              <span className="sl-lock">
                <Icon name="shield" /> Locked
              </span>
            </div>
            <dl className="sl-kvs">
              <div className="sl-kv">
                <dt>Legal name</dt>
                <dd>{p.businessName}</dd>
              </div>
              <div className="sl-kv">
                <dt>GSTIN</dt>
                <dd className="num">{p.gstin ?? "—"}</dd>
              </div>
              <div className="sl-kv">
                <dt>PAN</dt>
                <dd className="num">{p.pan ?? "—"}</dd>
              </div>
              <div className="sl-kv">
                <dt>Authorised brands</dt>
                <dd>{p.brandsAuthorised.length ? p.brandsAuthorised.join(", ") : "—"}</dd>
              </div>
              <div className="sl-kv">
                <dt>Commission</dt>
                <dd>{p.commissionPct}% of selling price</dd>
              </div>
              <div className="sl-kv">
                <dt>Seller since</dt>
                <dd>{fmtDate(p.approvedAt ?? p.createdAt)}</dd>
              </div>
              <div className="sl-kv">
                <dt>Store handle</dt>
                <dd className="num">{p.slug}</dd>
              </div>
            </dl>
            <div className="sl-card-foot">
              To change legal details or add a brand, email{" "}
              <a className="link" href={`mailto:${site.sellerEmail}?subject=${encodeURIComponent(`KYC update — ${p.displayName}`)}`}>
                {site.sellerEmail}
              </a>{" "}
              with the new GST certificate or brand authorisation letter.
            </div>
          </section>
          <section className="sl-card">
            <div className="sl-note">
              <Icon name="shield" />
              <span>
                <b>Your data is private.</b> Shoppers only see your store name. Bank details are visible to you and The Big Brands finance team only.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
