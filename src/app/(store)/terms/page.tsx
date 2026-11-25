import type { Metadata } from "next";
import Link from "next/link";
import { Gist, LegalShell, Sec } from "@/components/legal/legal-shell";
import { getPolicyFacts, JURISDICTION, POLICY_UPDATED, RETURN_DAYS } from "@/server/support/policy";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms that apply when you browse, shop, sell or advertise on The Big Brands.",
  alternates: { canonical: "/terms" },
};

const TOC = [
  { id: "about", label: "About these terms" },
  { id: "marketplace", label: "Our marketplace" },
  { id: "account", label: "Your account" },
  { id: "orders", label: "Orders, prices & payment" },
  { id: "gifts", label: "Free gifts, coupons & offers" },
  { id: "delivery", label: "Delivery, cancellation & returns" },
  { id: "authentic", label: "Authenticity & product information" },
  { id: "reviews", label: "Reviews & content you post" },
  { id: "use", label: "Acceptable use" },
  { id: "sellers", label: "Sellers & advertisers" },
  { id: "ip", label: "Intellectual property" },
  { id: "liability", label: "Liability" },
  { id: "law", label: "Governing law & disputes" },
  { id: "grievance", label: "Grievance officer" },
  { id: "changes", label: "Changes to these terms" },
];

/** /terms — Terms of use (marketplace intermediary terms under the IT Act 2000 and the Consumer Protection (E-Commerce) Rules, 2020). */
export default async function TermsPage() {
  const f = await getPolicyFacts();
  const { store } = f;
  return (
    <LegalShell
      current="/terms"
      kicker="Policy"
      title="Terms of use"
      intro={
        <>
          These terms are an agreement between you and {store.legalName} ({site.tagline}), which operates {site.name} at {site.domain}. By using the site or the apps you agree
          to them — please read them along with our <Link href="/privacy">Privacy policy</Link>.
        </>
      }
      updated={POLICY_UPDATED}
      toc={TOC}
    >
      <Gist
        items={[
          <>You must be 18 or older (or shopping with a parent&apos;s supervision) and keep your account details safe.</>,
          <>Prices include GST. An order is confirmed only when we send the confirmation, and we can cancel it with a full refund if something goes wrong.</>,
          <>Every order gets a free gift; gifts have no cash value and depend on stock.</>,
          <>Returns and refunds follow our <Link href="/returns">Cancellation, returns &amp; refunds</Link> policy.</>,
        ]}
      />

      <Sec id="about" n={1} title="About these terms">
        <p>
          &quot;We&quot;, &quot;us&quot; and &quot;The Big Brands&quot; mean {store.legalName}
          {store.address ? <>, with its registered office at {store.address}</> : null}. &quot;You&quot; means anyone who visits, shops, sells or advertises on {site.name}. These
          terms are an electronic record under the Information Technology Act, 2000 and don&apos;t need a physical or digital signature.
        </p>
      </Sec>

      <Sec id="marketplace" n={2} title="Our marketplace">
        <p>
          {site.name} is an online marketplace for beauty and personal-care products. Products are sold either by us (including our own label, <b>TBB Originals</b>) or by
          independent, verified sellers. The seller of each product is shown on the product page as &quot;Sold by …&quot; and on your invoice.
        </p>
        <p>
          For products sold by other sellers, the contract of sale is between you and that seller; we provide the platform, payment collection, customer care and the returns
          process. We remain responsible to you for the shopping experience described in these terms and our policies.
        </p>
      </Sec>

      <Sec id="account" n={3} title="Your account">
        <ul>
          <li>You can sign in with your mobile number (one-time code) or email and password. Give us accurate details and keep them up to date.</li>
          <li>You are responsible for activity on your account. Don&apos;t share your one-time codes or password — our team will never ask for them.</li>
          <li>You must be at least 18 years old to create an account; minors may use the site only under a parent or guardian&apos;s supervision.</li>
          <li>We may suspend accounts used for fraud, abuse of offers, fake reviews or anything that breaks these terms or the law.</li>
          <li>
            You can ask us to close your account at any time by writing to <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>.
          </li>
        </ul>
      </Sec>

      <Sec id="orders" n={4} title="Orders, prices & payment">
        <ul>
          <li>All prices are in Indian Rupees and include GST. The M.R.P. and the price you pay are shown side by side; the delivery fee, if any, is shown before you pay.</li>
          <li>
            Placing an order is an offer to buy. The contract is formed when we confirm the order by SMS/email. We may refuse or cancel an order (for example for stock problems,
            pricing errors, unserviceable pincodes or suspected fraud) and will refund any amount paid in full.
          </li>
          <li>We may limit quantities per customer, especially on deals.</li>
          <li>
            Online payments are processed by our payment partner (Razorpay) over secure, PCI-DSS compliant systems; we never see or store your full card details. Cash on delivery is
            offered where available.
          </li>
          <li>A GST invoice is available for every order from Your orders.</li>
        </ul>
      </Sec>

      <Sec id="gifts" n={5} title="Free gifts, coupons & offers">
        <ul>
          <li>Each order includes free TBB Originals gift(s), chosen at checkout before payment: {f.giftLine}.</li>
          <li>Gifts are free, have no cash value, can&apos;t be exchanged and depend on availability. If a chosen gift runs out we may send one of equal or higher value.</li>
          <li>Coupons and offers have their own conditions (minimum order, validity, brands, one use per customer) shown when you apply them. One coupon per order.</li>
          <li>We may withdraw an offer, coupon or gift that is being misused, for example through multiple accounts.</li>
        </ul>
      </Sec>

      <Sec id="delivery" n={6} title="Delivery, cancellation & returns">
        <p>
          Delivery is covered by our <Link href="/shipping">Shipping &amp; delivery</Link> policy. You may cancel before dispatch and return eligible items within {RETURN_DAYS}{" "}
          days of delivery as set out in <Link href="/returns">Cancellation, returns &amp; refunds</Link>. Ownership and risk pass to you on delivery.
        </p>
      </Sec>

      <Sec id="authentic" n={7} title="Authenticity & product information">
        <p>
          Every product on {site.name} is sourced from the brand or its authorised distributor, and sellers must provide brand authorisation before they can list. We try to
          make product photos, descriptions, ingredients, shades and prices accurate, but colours can look different on screens and brands may change packaging. Always read the
          label and do a patch test before using a new product. Product information comes from brands and sellers and is not medical advice.
        </p>
      </Sec>

      <Sec id="reviews" n={8} title="Reviews & content you post">
        <p>
          Reviews must be honest and about the product. Don&apos;t post anything unlawful, abusive, misleading, promotional or that infringes someone else&apos;s rights. By posting
          you give us a non-exclusive, royalty-free licence to show your content on {site.name} and in our marketing. We may remove content that breaks these rules; reviews are
          never edited to change their meaning.
        </p>
      </Sec>

      <Sec id="use" n={9} title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>use the site for anything unlawful, fraudulent or harmful, or resell products bought here commercially without our consent;</li>
          <li>scrape, copy or crawl the site with bots, or try to break into, overload or interfere with it;</li>
          <li>impersonate anyone, use someone else&apos;s payment method without permission, or create accounts to abuse offers.</li>
        </ul>
      </Sec>

      <Sec id="sellers" n={10} title="Sellers & advertisers">
        <p>
          Selling on {site.name} is subject to approval and to the seller agreement accepted during <Link href="/sell">seller registration</Link> (including commission, payouts,
          listing and fulfilment rules). Advertising is subject to our <Link href="/advertise">advertising terms</Link> and creative review. Sellers and advertisers are responsible
          for the legality and accuracy of their listings and ads. Sponsored listings and ads are always labelled as such.
        </p>
      </Sec>

      <Sec id="ip" n={11} title="Intellectual property">
        <p>
          The {site.name} name, logo, design and content belong to us or our licensors. Brand names and product images belong to their owners and are used to identify their
          products. Some photographs are used under open licences, credited on our <Link href="/credits">Image credits</Link> page. You may not copy or reuse site content
          without permission.
        </p>
      </Sec>

      <Sec id="liability" n={12} title="Liability">
        <p>
          We provide the site with reasonable care and skill. To the extent permitted by law, we are not liable for indirect or consequential losses, or for delays caused by
          events beyond our control (such as natural disasters, strikes or network outages). Our total liability for any order is limited to the amount you paid for it. Nothing
          in these terms limits your rights as a consumer under the Consumer Protection Act, 2019.
        </p>
      </Sec>

      <Sec id="law" n={13} title="Governing law & disputes">
        <p>
          These terms are governed by the laws of India. Please contact us first — most problems are solved quickly by our care team. If a dispute can&apos;t be resolved, the
          courts at {JURISDICTION} will have jurisdiction, without affecting your right to approach a consumer commission.
        </p>
      </Sec>

      <Sec id="grievance" n={14} title="Grievance officer">
        <p>
          In line with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, our grievance officer is <b>{f.grievance.name}</b>,{" "}
          {store.legalName}
          {store.address ? <>, {store.address}</> : null}. Email: <a href={`mailto:${f.grievance.email}`}>{f.grievance.email}</a>. We acknowledge complaints within 48 hours and
          resolve them within one month. See <Link href="/contact">Contact us</Link> for all the ways to reach us.
        </p>
      </Sec>

      <Sec id="changes" n={15} title="Changes to these terms">
        <p>
          We may update these terms from time to time; the date at the top shows the latest version. Significant changes will be highlighted on the site. Continuing to use{" "}
          {site.name} after a change means you accept the updated terms.
        </p>
      </Sec>
    </LegalShell>
  );
}
