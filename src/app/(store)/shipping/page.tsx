import type { Metadata } from "next";
import Link from "next/link";
import { Gist, LegalShell, Sec } from "@/components/legal/legal-shell";
import { getPolicyFacts, POLICY_UPDATED, RETURN_DAYS } from "@/server/support/policy";

export const metadata: Metadata = {
  title: "Shipping & delivery",
  description: "Delivery charges, timelines, cash on delivery and order tracking on The Big Brands.",
  alternates: { canonical: "/shipping" },
};

const TOC = [
  { id: "charges", label: "Delivery charges" },
  { id: "times", label: "Delivery times" },
  { id: "cod", label: "Cash on delivery" },
  { id: "tracking", label: "Tracking your order" },
  { id: "packages", label: "Multiple packages" },
  { id: "attempts", label: "Delivery attempts" },
  { id: "damaged", label: "Damaged or tampered parcels" },
  { id: "areas", label: "Where we deliver" },
];

/** /shipping — Shipping & delivery policy. Fees and thresholds come from the live "shipping" setting. */
export default async function ShippingPage() {
  const f = await getPolicyFacts();
  const partner = f.ship.partner || "our courier partners";
  return (
    <LegalShell
      current="/shipping"
      kicker="Policy"
      title="Shipping & delivery"
      intro={<>Packed with care, shipped fast and tracked end to end — here&apos;s what to expect after you place an order.</>}
      updated={POLICY_UPDATED}
      toc={TOC}
    >
      <Gist
        items={[
          <>
            <b>Free delivery</b> on orders of {f.freeShipping} or more; {f.shippingFee} below that.
          </>,
          <>Most orders ship within 1 working day and arrive in 2–5 working days in metro cities.</>,
          <>Cash on delivery is {f.ship.codEnabled ? <>available, with {f.codFee}</> : "currently paused"}.</>,
          <>Track every order live from <Link href="/account/orders">Your orders</Link>.</>,
        ]}
      />

      <Sec id="charges" n={1} title="Delivery charges">
        <div className="lg-tw">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Order value (after discounts)</th>
                <th>Delivery fee</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{f.freeShipping} and above</td>
                <td>
                  <b>Free</b>
                </td>
              </tr>
              <tr>
                <td>Below {f.freeShipping}</td>
                <td>{f.shippingFee} per order</td>
              </tr>
              {f.ship.codEnabled ? (
                <tr>
                  <td>Cash on delivery</td>
                  <td>{f.ship.codFee > 0 ? `${f.codFee} extra` : "No extra charge"}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p>The exact delivery fee is always shown in your cart and at checkout before you pay. Prices on The Big Brands include GST.</p>
      </Sec>

      <Sec id="times" n={2} title="Delivery times">
        <div className="lg-tw">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Where</th>
                <th>Usual delivery time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Metro cities (Delhi NCR, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad)</td>
                <td>2–5 working days</td>
              </tr>
              <tr>
                <td>Other cities and towns</td>
                <td>4–7 working days</td>
              </tr>
              <tr>
                <td>North-East, J&amp;K, Ladakh, islands and remote areas</td>
                <td>7–10 working days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Orders are usually packed and handed to {partner} within 1 working day (orders placed after 4 pm or on Sundays and public holidays ship the next working day). The
          estimated delivery date for your pincode is shown on the product page and at checkout. Sales, festivals and weather can occasionally add a day or two — we&apos;ll keep you
          posted by SMS.
        </p>
      </Sec>

      <Sec id="cod" n={3} title="Cash on delivery (COD)">
        {f.ship.codEnabled ? (
          <ul>
            <li>Pay in cash or by UPI to the delivery partner when your parcel arrives.</li>
            <li>{f.ship.codFee > 0 ? `A COD handling fee of ${f.codFee} applies.` : "There is no extra charge for COD."}</li>
            <li>COD may be unavailable for some pincodes, high-value orders, or accounts with repeated refused deliveries.</li>
            <li>Please keep the exact amount ready — delivery partners may not carry change.</li>
          </ul>
        ) : (
          <p>Cash on delivery is paused at the moment. You can pay securely by UPI, card or net banking.</p>
        )}
      </Sec>

      <Sec id="tracking" n={4} title="Tracking your order">
        <p>
          As soon as your order ships you&apos;ll get an SMS/email with the courier name and tracking number. You can follow every step — confirmed, packed, shipped, out for
          delivery and delivered — on the order page in <Link href="/account/orders">Your orders</Link>.
        </p>
      </Sec>

      <Sec id="packages" n={5} title="Multiple packages">
        <p>
          Products sold by different sellers, or stocked in different warehouses, may arrive in separate parcels on different days. You pay the delivery fee only once per
          order. Your free gift travels with the first package.
        </p>
      </Sec>

      <Sec id="attempts" n={6} title="Delivery attempts">
        <p>
          The courier makes up to 3 delivery attempts and will call the phone number on the order before each one. If the parcel can&apos;t be delivered — wrong address,
          unreachable phone or refused delivery — it returns to us and prepaid orders are refunded in full, minus the delivery fee if one was charged.
        </p>
      </Sec>

      <Sec id="damaged" n={7} title="Damaged or tampered parcels">
        <p>
          Please don&apos;t accept a parcel that looks opened, crushed or wet — refuse it and tell us. If you notice damage only after opening, request a return within {RETURN_DAYS}{" "}
          days from <Link href="/account/orders">Your orders</Link> (see <Link href="/returns">Cancellation, returns &amp; refunds</Link>). A short unboxing video or photos help
          us sort it out quickly.
        </p>
      </Sec>

      <Sec id="areas" n={8} title="Where we deliver">
        <p>
          We deliver to most pincodes across India. Enter your pincode on any product page to check delivery. We don&apos;t ship outside India at the moment. Questions?{" "}
          <Link href="/contact">Contact us</Link>.
        </p>
      </Sec>
    </LegalShell>
  );
}
