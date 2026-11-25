import type { Metadata } from "next";
import Link from "next/link";
import { Gist, LegalShell, Sec } from "@/components/legal/legal-shell";
import { getPolicyFacts, POLICY_UPDATED } from "@/server/support/policy";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal data The Big Brands collects, why, who we share it with, and the choices and rights you have.",
  alternates: { canonical: "/privacy" },
};

const TOC = [
  { id: "who", label: "Who we are" },
  { id: "collect", label: "What we collect" },
  { id: "use", label: "How we use it" },
  { id: "share", label: "Who we share it with" },
  { id: "cookies", label: "Cookies & device storage" },
  { id: "keep", label: "How long we keep it" },
  { id: "security", label: "Security" },
  { id: "rights", label: "Your rights & choices" },
  { id: "children", label: "Children" },
  { id: "contact", label: "Grievance officer & contact" },
  { id: "changes", label: "Changes to this policy" },
];

/** /privacy — Privacy policy (Digital Personal Data Protection Act, 2023 and IT Rules, 2011). */
export default async function PrivacyPage() {
  const f = await getPolicyFacts();
  const { store } = f;
  return (
    <LegalShell
      current="/privacy"
      kicker="Policy"
      title="Privacy policy"
      intro={<>We collect only what we need to deliver your orders and make shopping better — and we never sell your personal data.</>}
      updated={POLICY_UPDATED}
      toc={TOC}
    >
      <Gist
        items={[
          <>We use your details to process orders, deliver them, support you and keep your account secure.</>,
          <>Sellers and couriers get only what they need to ship your order. Advertisers only ever see anonymous, total numbers.</>,
          <>We never see or store your full card details — payments are handled by Razorpay.</>,
          <>You can access, correct or delete your data, and withdraw consent, at any time.</>,
        ]}
      />

      <Sec id="who" n={1} title="Who we are">
        <p>
          {site.name} ({site.domain} and our apps) is operated by {store.legalName}
          {store.address ? <>, {store.address}</> : null}. We are the &quot;data fiduciary&quot; for the personal data described here, under the Digital Personal Data Protection
          Act, 2023 (DPDP Act) and the Information Technology Act, 2000.
        </p>
      </Sec>

      <Sec id="collect" n={2} title="What we collect">
        <h3>Information you give us</h3>
        <ul>
          <li>
            <b>Account:</b> name, mobile number, email address and (if you choose one) a password, stored only as a secure hash.
          </li>
          <li>
            <b>Orders:</b> delivery addresses, the products and free gifts you choose, coupons used, and return or cancellation reasons.
          </li>
          <li>
            <b>Support:</b> messages you send through the Contact page, email or phone, and reviews you write.
          </li>
          <li>
            <b>Sellers and advertisers:</b> business details such as GSTIN, PAN, bank account and pickup address, and ad creatives, needed to verify you and pay you.
          </li>
        </ul>
        <h3>Information collected automatically</h3>
        <ul>
          <li>Device and log data such as IP address, browser type and pages viewed, used for security and to keep the site working.</li>
          <li>Searches you make and products you view, used to improve search results and recommendations.</li>
          <li>Ad impressions and clicks, counted to bill advertisers and stored only as daily totals per ad, never as a profile of you.</li>
        </ul>
        <h3>Payments</h3>
        <p>
          Card, UPI and net-banking details are entered on our payment partner Razorpay&apos;s secure page. We receive only a payment reference and status, never your full card
          number or UPI PIN.
        </p>
      </Sec>

      <Sec id="use" n={3} title="How we use it">
        <ul>
          <li>To create and secure your account, including sending one-time sign-in codes.</li>
          <li>To process payments, deliver orders, handle cancellations, returns and refunds, and issue GST invoices.</li>
          <li>To answer your questions and resolve complaints.</li>
          <li>To show relevant products, deals and sponsored listings on the site. Ads are chosen by page and placement, not by tracking you across other websites.</li>
          <li>To prevent fraud and abuse, and to meet our legal, tax and accounting obligations.</li>
          <li>To send order updates by SMS/email. We send marketing messages only if you agree, and every message includes a way to stop them.</li>
        </ul>
        <p>
          We process your data on the basis of your consent, which you give when you sign up or place an order, and for the legitimate uses the DPDP Act allows, such as
          fulfilling an order you asked for or complying with the law.
        </p>
      </Sec>

      <Sec id="share" n={4} title="Who we share it with">
        <p>We never sell your personal data. We share only what each party needs:</p>
        <ul>
          <li>
            <b>Sellers</b> of the products you buy see your name, delivery address, phone number and the items they must ship, and nothing else about your account.
          </li>
          <li>
            <b>Courier partners</b> ({f.ship.partner || "our logistics partners"}) receive the delivery address and phone number.
          </li>
          <li>
            <b>Service providers</b> who work for us under contract, including Razorpay (payments), MSG91 (SMS codes), our email provider, and our cloud hosting and storage
            providers in India.
          </li>
          <li>
            <b>Advertisers</b> receive only aggregated numbers, such as impressions and clicks per ad, never your identity.
          </li>
          <li>
            <b>Authorities</b>, when the law requires it or to protect the rights and safety of our users.
          </li>
        </ul>
      </Sec>

      <Sec id="cookies" n={5} title="Cookies & device storage">
        <p>We use a small number of first-party cookies, and no third-party advertising cookies:</p>
        <div className="lg-tw">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>tbb_session</td>
                <td>Keeps you signed in on the store</td>
                <td>30 days</td>
              </tr>
              <tr>
                <td>tbb_seller_session / tbb_admin_session</td>
                <td>Separate sign-ins for the seller portal and the admin console</td>
                <td>30 days</td>
              </tr>
              <tr>
                <td>tbb_cart</td>
                <td>Remembers a guest cart before you sign in</td>
                <td>Until you sign in or clear it</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We also save small preferences in your browser, such as your delivery pincode and an unfinished seller application, so you don&apos;t have to type them again. These
          are needed for the site to work, and you can clear them anytime in your browser settings.
        </p>
      </Sec>

      <Sec id="keep" n={6} title="How long we keep it">
        <ul>
          <li>Account data: for as long as your account is open. We delete or anonymise it within 90 days of you asking us to close it.</li>
          <li>Order and invoice records: 8 years, as required by tax and accounting laws.</li>
          <li>Support messages: up to 3 years. Security logs: up to 1 year.</li>
        </ul>
      </Sec>

      <Sec id="security" n={7} title="Security">
        <p>
          We use HTTPS everywhere, hashed passwords, short-lived one-time codes, signed sessions you can sign out of, and role-based access for our staff. Uploads are checked
          before they are stored. No system is perfectly secure, so please keep your codes and password private. If we ever have a data breach that affects you, we will
          inform you and the Data Protection Board as the law requires.
        </p>
      </Sec>

      <Sec id="rights" n={8} title="Your rights & choices">
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li>ask for a summary of the personal data we hold about you and how it is used;</li>
          <li>
            correct or update it (most details can be edited in <Link href="/account">Your account</Link>);
          </li>
          <li>ask us to delete it, unless we must keep it by law (for example, invoices);</li>
          <li>withdraw consent, such as for marketing messages, at any time;</li>
          <li>nominate someone to exercise these rights on your behalf;</li>
          <li>raise a grievance with us, and then with the Data Protection Board of India if you are not satisfied.</li>
        </ul>
        <p>
          To use any of these rights, email <a href={`mailto:${f.grievance.email}`}>{f.grievance.email}</a> from your registered email, or <Link href="/contact">contact us</Link>.
          We reply within 30 days.
        </p>
      </Sec>

      <Sec id="children" n={9} title="Children">
        <p>
          {site.name} is meant for adults. We don&apos;t knowingly collect personal data from anyone under 18 without verifiable consent from a parent or guardian. If you
          believe a child has given us data, please contact us and we will delete it.
        </p>
      </Sec>

      <Sec id="contact" n={10} title="Grievance officer & contact">
        <p>
          <b>{f.grievance.name}</b>, {store.legalName}
          {store.address ? <>, {store.address}</> : null}
          <br />
          Email: <a href={`mailto:${f.grievance.email}`}>{f.grievance.email}</a> · Phone:{" "}
          <a href={`tel:${store.supportPhone.replace(/\s+/g, "")}`}>{store.supportPhone}</a>
          <br />
          We acknowledge complaints within 48 hours and resolve them within one month.
        </p>
      </Sec>

      <Sec id="changes" n={11} title="Changes to this policy">
        <p>
          We&apos;ll update this policy when our practices change. The date at the top shows the latest version, and we&apos;ll tell you about significant changes by email or
          with a notice on the site.
        </p>
      </Sec>
    </LegalShell>
  );
}
