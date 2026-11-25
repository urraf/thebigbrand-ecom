import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalShell } from "@/components/legal/legal-shell";
import { HelpSearch } from "@/components/legal/help-search";
import { Icon, type IconName } from "@/components/ui/icon";
import { getPolicyFacts, REFUND_DAYS, RETURN_DAYS, SUPPORT_HOURS, UNPAID_EXPIRY_MIN } from "@/server/support/policy";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Answers about orders, delivery, free gifts, payments, returns and refunds on The Big Brands.",
  alternates: { canonical: "/help" },
};

type QA = { q: string; a: ReactNode; text: string };
type Cat = { id: string; icon: IconName; title: string; items: QA[] };

/** Plain-text version of an answer for the FAQPage structured data. */
const qa = (q: string, a: ReactNode, text: string): QA => ({ q, a, text });

/** /help — Help centre: quick links, searchable FAQ by topic (FAQPage JSON-LD), and contact options. */
export default async function HelpPage() {
  const f = await getPolicyFacts();
  const cats: Cat[] = [
    {
      id: "orders",
      icon: "box",
      title: "Orders & delivery",
      items: [
        qa(
          "How do I track my order?",
          <>Open <Link href="/account/orders">Your orders</Link> and choose the order — you&apos;ll see every step from confirmed to delivered, plus the courier tracking number once it ships.</>,
          "Open Your orders and choose the order to see every step and the courier tracking number.",
        ),
        qa(
          "How much is delivery?",
          <>Delivery is free on orders of {f.freeShipping} or more; below that it&apos;s {f.shippingFee}. See <Link href="/shipping">Shipping &amp; delivery</Link>.</>,
          `Delivery is free on orders of ${f.freeShipping} or more; below that it is ${f.shippingFee}.`,
        ),
        qa(
          "When will my order arrive?",
          <>Most orders ship within 1 working day and arrive in 2–5 working days in metro cities, 4–7 elsewhere. The estimated date for your pincode is shown before you pay.</>,
          "Most orders ship within 1 working day and arrive in 2–5 working days in metro cities and 4–7 elsewhere.",
        ),
        qa(
          "Can I change my delivery address after ordering?",
          <>If the order hasn&apos;t shipped, <Link href="/contact?topic=order">contact us</Link> quickly and we&apos;ll try to update it. Otherwise you can cancel and re-order before it ships.</>,
          "If the order has not shipped, contact us and we will try to update it, or cancel and re-order.",
        ),
        qa(
          "Why did my order arrive in more than one box?",
          <>Products from different sellers or warehouses ship separately. You pay delivery only once, and your free gift comes with the first box.</>,
          "Products from different sellers or warehouses ship separately; you pay delivery only once.",
        ),
      ],
    },
    {
      id: "gifts",
      icon: "gift",
      title: "Free gifts",
      items: [
        qa(
          "How does the free gift work?",
          <>Every order includes free TBB Originals mini(s) that you pick at checkout, before paying: {f.giftLine}. Browse them in the <Link href="/gifts">Free Gift Store</Link>.</>,
          `Every order includes free TBB Originals minis chosen at checkout before payment: ${f.giftLine}.`,
        ),
        qa(
          "Do I have to return the gift if I return my order?",
          <>No — the free gift is yours to keep, even if you return everything else.</>,
          "No, the free gift is yours to keep.",
        ),
        qa(
          "My chosen gift is out of stock — what happens?",
          <>Only gifts in stock are shown at checkout. If one runs out after you order, we&apos;ll send one of equal or higher value.</>,
          "Only gifts in stock are shown; if one runs out after ordering we send one of equal or higher value.",
        ),
      ],
    },
    {
      id: "payments",
      icon: "card",
      title: "Payments & coupons",
      items: [
        qa(
          "Which payment methods can I use?",
          <>UPI, credit and debit cards, net banking and wallets through Razorpay&apos;s secure checkout{f.ship.codEnabled ? <>, plus cash on delivery ({f.codFee})</> : null}.</>,
          `UPI, cards, net banking and wallets via Razorpay${f.ship.codEnabled ? ", plus cash on delivery" : ""}.`,
        ),
        qa(
          "Money was debited but my order failed. What now?",
          <>Don&apos;t worry — failed payments are reversed automatically to your account within {REFUND_DAYS}. Unpaid orders are cancelled after {UNPAID_EXPIRY_MIN} minutes.</>,
          `Failed payments are reversed automatically within ${REFUND_DAYS}.`,
        ),
        qa(
          "How do I use a coupon?",
          <>Enter the code in your cart or at checkout. Conditions such as minimum order or brands are shown when you apply it. One coupon per order.</>,
          "Enter the code in your cart or at checkout; one coupon per order.",
        ),
        qa(
          "Where is my GST invoice?",
          <>Open the order in <Link href="/account/orders">Your orders</Link> and tap <b>Invoice</b> to view or print it.</>,
          "Open the order in Your orders and tap Invoice.",
        ),
      ],
    },
    {
      id: "returns",
      icon: "ret",
      title: "Cancellations, returns & refunds",
      items: [
        qa(
          "How do I cancel an order?",
          <>Before it ships, open the order in <Link href="/account/orders">Your orders</Link> and tap <b>Cancel</b>. Prepaid orders are refunded in full.</>,
          "Before it ships, open the order in Your orders and tap Cancel; prepaid orders are refunded in full.",
        ),
        qa(
          "How do I return a product?",
          <>Within {RETURN_DAYS} days of delivery, open the order and tap <b>Return items</b>. We call within 24 hours to arrange a free pickup. Details in <Link href="/returns">our returns policy</Link>.</>,
          `Within ${RETURN_DAYS} days of delivery, open the order and tap Return items; pickup is free.`,
        ),
        qa(
          "Can I return an opened product?",
          <>Yes if it arrived damaged, is wrong, has a quality or authenticity issue, or caused a reaction. For change-of-mind returns it must be unopened and sealed.</>,
          "Yes for damaged, wrong, quality or reaction issues; change-of-mind returns must be unopened.",
        ),
        qa(
          "When will I get my refund?",
          <>Within {REFUND_DAYS} after the return is picked up and checked, to your original payment method (or your bank account/UPI for COD orders).</>,
          `Within ${REFUND_DAYS} after pickup and inspection, to the original payment method.`,
        ),
      ],
    },
    {
      id: "account",
      icon: "user",
      title: "Account & security",
      items: [
        qa(
          "How do I sign in?",
          <>Use your mobile number and the one-time code we text you, or your email and password, on the <Link href="/login">sign-in page</Link>.</>,
          "Use your mobile number and a one-time code, or your email and password.",
        ),
        qa(
          "Is my shopping account the same as my seller account?",
          <>They use separate sign-ins. Signing in to the store never signs you in to the <Link href="/seller">seller portal</Link> or the other way round, so each stays private.</>,
          "They use separate sign-ins; signing in to the store never signs you in to the seller portal.",
        ),
        qa(
          "How do I update or delete my details?",
          <>Edit your name, email and addresses in <Link href="/account">Your account</Link>. To delete your account or get a copy of your data, <Link href="/contact?topic=account">contact us</Link> — see our <Link href="/privacy">Privacy policy</Link>.</>,
          "Edit details in Your account; contact us to delete your account or get a copy of your data.",
        ),
        qa(
          "Are products on The Big Brands genuine?",
          <>Always. Products come straight from brands or their authorised distributors, and every seller is verified. See our <Link href="/about#authentic">authenticity promise</Link>.</>,
          "Yes, products come from brands or authorised distributors and every seller is verified.",
        ),
      ],
    },
    {
      id: "business",
      icon: "store",
      title: "Selling & advertising",
      items: [
        qa(
          "How do I start selling on The Big Brands?",
          <>Apply on <Link href="/sell">Sell on The Big Brands</Link> with your GSTIN, PAN and bank details. Most applications are approved within 2 working days.</>,
          "Apply on the Sell page with your GSTIN, PAN and bank details.",
        ),
        qa(
          "How can my brand advertise?",
          <>Book billboards, sponsored products, reels and in-box sampling yourself on <Link href="/advertise">Advertise</Link>, or write to us and our team will plan a campaign.</>,
          "Book ad placements yourself on the Advertise page, or write to our team.",
        ),
      ],
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cats.flatMap((c) => c.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.text } }))),
  };

  return (
    <LegalShell current="/help" kicker="Help centre" title="Hi, how can we help?" intro={<HelpSearch target="hc-cats" />} wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="hc-quick">
        <Link href="/account/orders">
          <Icon name="truck" />
          <b>Track an order</b>
          <span>See where your parcel is</span>
        </Link>
        <Link href="/account/orders">
          <Icon name="ret" />
          <b>Return or cancel</b>
          <span>Free pickup · refund in {REFUND_DAYS}</span>
        </Link>
        <Link href="/gifts">
          <Icon name="gift" />
          <b>Free gifts</b>
          <span>How your free minis work</span>
        </Link>
        <Link href="/contact">
          <Icon name="phone" />
          <b>Contact us</b>
          <span>{SUPPORT_HOURS}</span>
        </Link>
      </div>

      <div className="hc-cats" id="hc-cats">
        {cats.map((c) => (
          <section key={c.id} className="hc-cat" id={c.id} aria-labelledby={`${c.id}-h`}>
            <h2 id={`${c.id}-h`}>
              <Icon name={c.icon} />
              {c.title}
            </h2>
            {c.items.map((i) => (
              <details key={i.q} className="hc-q">
                <summary>{i.q}</summary>
                <div>
                  <p>{i.a}</p>
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>

      <div className="hc-more">
        <div>
          <b>Still need help?</b>
          <span>
            Call {f.store.supportPhone} (toll-free, {SUPPORT_HOURS}) or send us a message.
          </span>
        </div>
        <Link className="btn btn-cart" href="/contact">
          Contact us <Icon name="arrow" />
        </Link>
      </div>

      <nav className="hc-pols" aria-label="Policies">
        <Link href="/shipping">Shipping &amp; delivery</Link>
        <Link href="/returns">Cancellation, returns &amp; refunds</Link>
        <Link href="/terms">Terms of use</Link>
        <Link href="/privacy">Privacy policy</Link>
      </nav>
    </LegalShell>
  );
}
