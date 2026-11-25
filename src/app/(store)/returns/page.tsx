import type { Metadata } from "next";
import Link from "next/link";
import { Gist, LegalShell, Sec } from "@/components/legal/legal-shell";
import { Icon } from "@/components/ui/icon";
import { getPolicyFacts, POLICY_UPDATED, REFUND_DAYS, RETURN_DAYS, UNPAID_EXPIRY_MIN } from "@/server/support/policy";

export const metadata: Metadata = {
  title: "Cancellation, returns & refunds",
  description: `Cancel before dispatch, return within ${RETURN_DAYS} days of delivery with free pickup, and get your refund in ${REFUND_DAYS}. Keep the free gift.`,
  alternates: { canonical: "/returns" },
};

const TOC = [
  { id: "cancel", label: "Cancelling an order" },
  { id: "returns", label: "Returns" },
  { id: "eligible", label: "What can be returned" },
  { id: "how", label: "How to return" },
  { id: "refunds", label: "Refunds" },
  { id: "gifts", label: "Free gifts & coupons" },
  { id: "failed", label: "Failed or duplicate payments" },
  { id: "sellers", label: "Orders from marketplace sellers" },
  { id: "help", label: "Need help?" },
];

/** /returns — Cancellation, Returns & Refund policy (required by Razorpay and the Consumer Protection (E-Commerce) Rules, 2020). */
export default async function ReturnsPage() {
  const f = await getPolicyFacts();
  return (
    <LegalShell
      current="/returns"
      kicker="Policy"
      title="Cancellation, returns & refunds"
      intro={<>Changed your mind, or something isn&apos;t right? Here&apos;s exactly how cancelling, returning and refunds work on The Big Brands.</>}
      updated={POLICY_UPDATED}
      toc={TOC}
    >
      <Gist
        items={[
          <>Cancel any order for free until it is shipped — from <Link href="/account/orders">Your orders</Link>.</>,
          <>Return within <b>{RETURN_DAYS} days of delivery</b>. Pickup is free; we call you within 24 hours to arrange it.</>,
          <>Refunds reach your original payment method in <b>{REFUND_DAYS}</b> after the return is picked up and checked.</>,
          <>The free TBB Originals gift is yours to keep — it never needs to come back.</>,
        ]}
      />

      <Sec id="cancel" n={1} title="Cancelling an order">
        <p>
          You can cancel an order — or individual items in it — at no charge while it is <b>placed, confirmed or being packed</b>. Open{" "}
          <Link href="/account/orders">Your orders</Link>, choose the order and tap <b>Cancel</b>. Once an item has been handed to the courier it can no longer be cancelled; you
          can refuse the delivery or request a return after it arrives instead.
        </p>
        <ul>
          <li>Prepaid orders are refunded in full, including any delivery fee, to the original payment method.</li>
          <li>Cash-on-delivery orders are simply cancelled — nothing is charged.</li>
          <li>
            We may cancel an order ourselves if an item goes out of stock, the delivery address is not serviceable, the price was listed incorrectly, or the order looks fraudulent.
            If that happens we tell you by SMS/email and refund any amount paid in full.
          </li>
        </ul>
      </Sec>

      <Sec id="returns" n={2} title="Returns">
        <p>
          You can ask to return an item within <b>{RETURN_DAYS} days of delivery</b>. The return window for each item is shown on the order page in{" "}
          <Link href="/account/orders">Your orders</Link>. Beauty and personal-care products are hygiene-sensitive, so the reason for the return decides what we accept:
        </p>
      </Sec>

      <Sec id="eligible" n={3} title="What can be returned">
        <div className="lg-tw">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Accepted?</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Arrived damaged, broken or leaking</td>
                <td>Yes</td>
                <td>Report within {RETURN_DAYS} days; photos of the product and outer box help us resolve it faster.</td>
              </tr>
              <tr>
                <td>Wrong item, shade or size received</td>
                <td>Yes</td>
                <td>Unused, with original packaging.</td>
              </tr>
              <tr>
                <td>Not as described, or expired / near-expiry</td>
                <td>Yes</td>
                <td>Report within {RETURN_DAYS} days of delivery.</td>
              </tr>
              <tr>
                <td>Quality or authenticity concern</td>
                <td>Yes</td>
                <td>Even if opened — we investigate every report with the brand.</td>
              </tr>
              <tr>
                <td>Skin reaction or allergy</td>
                <td>Yes, case by case</td>
                <td>Even if opened; a photo or doctor&apos;s note may be requested.</td>
              </tr>
              <tr>
                <td>Changed my mind</td>
                <td>Yes</td>
                <td>Only if unopened, unused and with the seal, tags and packaging intact.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Not returnable</h3>
        <ul>
          <li>Opened or used products returned for a change of mind (for hygiene reasons).</li>
          <li>Products with a broken seal or missing packaging, unless they arrived that way.</li>
          <li>Free gifts, samples and in-box brand sampling items.</li>
        </ul>
      </Sec>

      <Sec id="how" n={4} title="How to return">
        <ol>
          <li>
            Go to <Link href="/account/orders">Your orders</Link>, open the delivered order and tap <b>Return items</b>.
          </li>
          <li>Choose the items and a reason, and add a note or photo details if something was damaged.</li>
          <li>Our team calls you within 24 hours to confirm and schedule a <b>free pickup</b> from your delivery address.</li>
          <li>Pack the item in its original packaging. The courier does a quick check at pickup.</li>
          <li>Once the item reaches us and passes inspection (usually 2–3 working days), your refund is started.</li>
        </ol>
        <p className="lg-note">
          <Icon name="info" />
          <span>Please don&apos;t send returns to us without a confirmed pickup — we can&apos;t trace parcels that arrive without a return request.</span>
        </p>
      </Sec>

      <Sec id="refunds" n={5} title="Refunds">
        <div className="lg-tw">
          <table className="lg-table">
            <thead>
              <tr>
                <th>You paid with</th>
                <th>Refunded to</th>
                <th>Time after approval</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>UPI</td>
                <td>The same UPI account</td>
                <td>{REFUND_DAYS} (often sooner)</td>
              </tr>
              <tr>
                <td>Credit / debit card</td>
                <td>The same card</td>
                <td>{REFUND_DAYS}; your bank may take one statement cycle to show it</td>
              </tr>
              <tr>
                <td>Net banking / wallet</td>
                <td>The same account or wallet</td>
                <td>{REFUND_DAYS}</td>
              </tr>
              <tr>
                <td>Cash on delivery</td>
                <td>Your bank account or UPI ID (we ask for it on the pickup call)</td>
                <td>{REFUND_DAYS}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li>You get back the price you paid for the returned items, after any discount or coupon applied to them.</li>
          <li>The delivery fee is refunded when the whole order is returned because of our mistake (damaged, wrong or defective items).</li>
          <li>You&apos;ll get an SMS/email when the refund is issued, and the order page shows its status.</li>
          <li>
            If a refund hasn&apos;t reached you after {REFUND_DAYS}, write to <a href={`mailto:${f.store.supportEmail}`}>{f.store.supportEmail}</a> with your order number and
            we&apos;ll share the bank reference (RRN/ARN).
          </li>
        </ul>
      </Sec>

      <Sec id="gifts" n={6} title="Free gifts & coupons">
        <ul>
          <li>The free TBB Originals gift(s) you chose at checkout are yours to keep, even if you return everything else.</li>
          <li>If you cancel a whole order before it ships, the coupon you used is restored to your account (if it is still valid).</li>
          <li>Partial returns don&apos;t change the gift you received, even if the remaining amount falls below a gift tier.</li>
        </ul>
      </Sec>

      <Sec id="failed" n={7} title="Failed or duplicate payments">
        <p>
          If money was debited but the order didn&apos;t go through, the payment is reversed automatically by your bank or our payment partner, usually within {REFUND_DAYS}.
          Unpaid online orders are cancelled after {UNPAID_EXPIRY_MIN} minutes and any reserved stock is released. If you were charged twice for one order, contact us and we&apos;ll
          refund the duplicate immediately.
        </p>
      </Sec>

      <Sec id="sellers" n={8} title="Orders from marketplace sellers">
        <p>
          Some products are sold by verified third-party sellers on The Big Brands (shown as &quot;Sold by …&quot; on the product page). This policy applies to every order on
          the site, whoever the seller is — you always raise cancellations and returns with us, and we handle them with the seller.
        </p>
      </Sec>

      <Sec id="help" n={9} title="Need help?">
        <p>
          Our customer care team is here for you: <a href={`mailto:${f.store.supportEmail}`}>{f.store.supportEmail}</a> ·{" "}
          <a href={`tel:${f.store.supportPhone.replace(/\s+/g, "")}`}>{f.store.supportPhone}</a> (toll-free). You can also{" "}
          <Link href="/contact">send us a message</Link> or browse the <Link href="/help">Help centre</Link>.
        </p>
      </Sec>
    </LegalShell>
  );
}
