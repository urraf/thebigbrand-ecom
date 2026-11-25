import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LegalShell, Sec } from "@/components/legal/legal-shell";
import { ContactForm } from "@/components/legal/contact-form";
import { Icon } from "@/components/ui/icon";
import { getAuth } from "@/lib/auth";
import { site } from "@/lib/site";
import { CONTACT_TOPICS } from "@/server/support/contact";
import { getPolicyFacts, SUPPORT_HOURS } from "@/server/support/policy";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Reach The Big Brands customer care by phone, email or message — plus seller, advertising and grievance contacts.",
  alternates: { canonical: "/contact" },
};

const TOPICS = Object.entries(CONTACT_TOPICS).map(([value, label]) => ({ value, label }));

/** Prefills the form for signed-in shoppers (dynamic part, streamed). */
async function SignedInForm({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const [auth, sp] = await Promise.all([getAuth(), searchParams]);
  const topic = sp.topic && sp.topic in CONTACT_TOPICS ? sp.topic : sp.order ? "order" : "";
  return (
    <ContactForm
      topics={TOPICS}
      initial={{ name: auth?.user.name ?? "", email: auth?.user.email ?? "", phone: auth?.user.phone ?? "", orderNumber: (sp.order ?? "").slice(0, 30), topic }}
    />
  );
}

/** /contact — customer care, seller/ads contacts, registered office, grievance officer and the message form. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const f = await getPolicyFacts();
  const { store } = f;
  const tel = store.supportPhone.replace(/\s+/g, "");
  return (
    <LegalShell
      current="/contact"
      kicker="We're here to help"
      title="Contact us"
      intro={
        <>
          Most answers are a tap away in the <Link href="/help">Help centre</Link> or <Link href="/account/orders">Your orders</Link>. Still stuck? Call, write or send us a
          message — a real person replies.
        </>
      }
      toc={[
        { id: "reach", label: "Ways to reach us" },
        { id: "message", label: "Send a message" },
        { id: "office", label: "Registered office & grievances" },
      ]}
    >
      <Sec id="reach" title="Ways to reach us">
        <div className="ct-cards">
          <div className="ct-card">
            <Icon name="phone" />
            <h3>Call customer care</h3>
            <a href={`tel:${tel}`}>{store.supportPhone}</a>
            <small>Toll-free · {SUPPORT_HOURS}</small>
          </div>
          <div className="ct-card">
            <Icon name="info" />
            <h3>Email us</h3>
            <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
            <small>Replies within 24 hours</small>
          </div>
          <div className="ct-card">
            <Icon name="box" />
            <h3>Order help</h3>
            <Link href="/account/orders">Track, cancel or return</Link>
            <small>Fastest for anything about an order</small>
          </div>
          <div className="ct-card">
            <Icon name="store" />
            <h3>Sell on The Big Brands</h3>
            <a href={`mailto:${site.sellerEmail}`}>{site.sellerEmail}</a>
            <small>
              <Link href="/sell">Become a seller</Link>
            </small>
          </div>
          <div className="ct-card">
            <Icon name="megaphone" />
            <h3>Brands &amp; advertising</h3>
            <a href={`mailto:${site.adsEmail}`}>{site.adsEmail}</a>
            <small>
              <Link href="/advertise">Advertise with us</Link>
            </small>
          </div>
          <div className="ct-card">
            <Icon name="shield" />
            <h3>Grievance officer</h3>
            <a href={`mailto:${f.grievance.email}`}>{f.grievance.email}</a>
            <small>Acknowledged within 48 hours</small>
          </div>
        </div>
      </Sec>

      <Sec id="message" title="Send a message">
        <Suspense fallback={<ContactForm topics={TOPICS} initial={{}} />}>
          <SignedInForm searchParams={searchParams} />
        </Suspense>
      </Sec>

      <Sec id="office" title="Registered office & grievances">
        <div className="ct-office">
          <div>
            <h3>Registered office</h3>
            <p>
              {store.legalName}
              {store.address ? (
                <>
                  <br />
                  {store.address}
                </>
              ) : null}
              {store.gstin ? (
                <>
                  <br />
                  GSTIN {store.gstin}
                </>
              ) : null}
            </p>
          </div>
          <div>
            <h3>Grievance officer</h3>
            <p>
              {f.grievance.name}
              <br />
              <a href={`mailto:${f.grievance.email}`}>{f.grievance.email}</a> · <a href={`tel:${tel}`}>{store.supportPhone}</a>
              <br />
              Complaints are acknowledged within 48 hours and resolved within one month, as required by the Consumer Protection (E-Commerce) Rules, 2020.
            </p>
          </div>
        </div>
      </Sec>
    </LegalShell>
  );
}
