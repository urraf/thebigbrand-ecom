import type { Metadata } from "next";
import Link from "next/link";
import { formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import { Icon, type IconName } from "@/components/ui/icon";
import { EarnCalc } from "@/components/seller/earn-calc";
import { getSellLandingStats } from "@/server/seller/options";
import "@/styles/seller/sell.css";

export const metadata: Metadata = {
  title: "Sell on The Big Brands",
  description: "Sell your beauty brands to India's shoppers. 12% commission, no listing fees, weekly payouts, free-gift traffic and sponsored-product ads from ₹5 a click.",
  openGraph: { title: "Sell on The Big Brands", description: "12% commission · weekly payouts · free-gift traffic on every order." },
};

const COMMISSION = 12;

const WHY: { icon: IconName; title: string; body: string }[] = [
  { icon: "users", title: "Shoppers who came to buy", body: "Beauty-only traffic from search, deals and brand stores — people looking for exactly what you stock, not browsing a general bazaar." },
  { icon: "gift", title: "Free-gift traffic", body: "Every order ships with free TBB Originals the shopper picks before paying. It's why they come back — and your products ride along in every basket." },
  { icon: "percent", title: `Flat ${COMMISSION}% commission`, body: "One simple rate on the selling price. No listing fee, no payment-collection fee, no fixed closing fee eating into low-ticket items." },
  { icon: "card", title: "Paid every week", body: "Earnings are credited the moment an item is delivered and paid out to your bank every Wednesday. Track every rupee in your ledger." },
  { icon: "megaphone", title: "Built-in ad tools", body: "Promote any live product to the top of search results and on related product pages. Pay per click, set a budget, pause any time." },
  { icon: "shield", title: "Authentic-only marketplace", body: "We verify every seller and every listing. Shoppers trust what they buy here — so they convert better and return less." },
];

const STEPS = [
  { t: "Apply", d: "GSTIN, PAN, bank and the brands you're authorised for.", s: "5 minutes" },
  { t: "KYC check", d: "We verify your documents and brand authorisations.", s: "Within 2 working days" },
  { t: "List", d: "Add products with photos, price and stock. Each listing gets a quick authenticity check.", s: "Live in ~24 hours" },
  { t: "Ship", d: "Confirm, pack with the printed slip and hand over to your courier with the AWB.", s: "Dispatch in 48 hours" },
  { t: "Get paid", d: "Delivered items are credited to your ledger, minus commission, and paid weekly.", s: "Every Wednesday" },
];

const FAQ = [
  ["Who can sell on The Big Brands?", "GST-registered brands, distributors and authorised resellers of genuine beauty and personal-care products. You'll need a GSTIN, a business PAN, a current account in the business's name and authorisation from each brand you list."],
  ["How much does it cost?", `There's no sign-up or listing fee. We charge a flat ${COMMISSION}% commission on the selling price of each delivered item — that's it. Sponsored ads are optional and billed per click.`],
  ["When do I get paid?", "Your earning for an item (selling price minus commission) is credited to your seller ledger as soon as it's delivered. Your available balance is paid to your bank account every Wednesday. If an item is returned, that earning is reversed."],
  ["Who handles shipping?", "You ship from your own warehouse with your preferred courier and enter the AWB number in Seller Central when you dispatch. Shoppers see the courier and tracking number on their order. Packing slips print straight from your orders page."],
  ["What about the free gifts in every order?", "The Big Brands packs and ships the free TBB Originals gifts separately at our cost. You ship only your items — the gift is what keeps shoppers coming back."],
  ["Can I sell any brand?", "Only brands you're authorised to sell. We check authorisation letters during KYC and you can add brands later by sending the letter to seller support."],
  ["How do sponsored ads work?", "From Seller Central, pick a live product, choose search results or product pages, set dates and a budget (from ₹5,000). You pay per click, never for views, and can pause any time. Every sponsored placement is clearly labelled."],
  ["Is there a seller app?", "A seller app for confirming orders, printing labels and tracking payouts is coming soon. Seller Central works on any phone browser today, and everything you do there will carry over."],
];

export default async function SellPage() {
  const stats = await getSellLandingStats();
  const cpc = stats.cpcFrom ?? 5;
  return (
    <div className="sell">
      <section className="sell-hero" aria-labelledby="sell-h1">
        <div className="wrap sell-hero-in">
          <div>
            <span className="sell-pill">
              <b>Seller Central</b> Now onboarding beauty brands &amp; distributors
            </span>
            <h1 id="sell-h1">
              Sell to India&apos;s beauty shoppers on <em>The Big Brands</em>
            </h1>
            <p className="sell-lead">
              List your authorised brands where shoppers come specifically for beauty — and leave with a free gift in every order. Flat {COMMISSION}% commission, weekly payouts, and ad tools to get seen first.
            </p>
            <div className="sell-ctas">
              <Link href="/seller/register" className="btn btn-cart btn-lg">
                Start selling <Icon name="arrow" />
              </Link>
              <Link href="/seller/login" className="btn btn-lg sell-btn-o">
                Seller sign in
              </Link>
            </div>
            <ul className="sell-ticks">
              <li>
                <Icon name="check" /> No listing fees
              </li>
              <li>
                <Icon name="check" /> Paid every Wednesday
              </li>
              <li>
                <Icon name="check" /> Approval in 2 working days
              </li>
            </ul>
          </div>
          <div className="sell-hv" aria-hidden="true">
            <div className="sell-win">
              <div className="sell-win-bar">
                <i />
                <i />
                <i />
                <span>seller.{site.domain}</span>
              </div>
              <div className="sell-win-in">
                <div className="sell-win-side">
                  <b />
                  <i className="on" />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="sell-win-main">
                  <div className="sell-win-kpis">
                    <div>
                      <small>Sales · 30 days</small>
                      <b>₹1,84,920</b>
                      <em>▲ 24%</em>
                    </div>
                    <div>
                      <small>To ship</small>
                      <b>18</b>
                    </div>
                    <div>
                      <small>Balance</small>
                      <b>₹42,180</b>
                    </div>
                  </div>
                  <div className="sell-win-chart">
                    {[38, 52, 44, 61, 58, 72, 49, 66, 80, 74, 92, 85, 100, 88].map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="sell-win-rows">
                    <div>
                      <b>Beard &amp; Hair Growth Oil × 2</b>
                      <span>New</span>
                    </div>
                    <div>
                      <b>Organic Oud Eau de Parfum</b>
                      <span className="ok">Shipped</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className="sell-tag sell-t1">
              <i>
                <Icon name="card" />
              </i>
              <span>
                Payout sent · ₹42,180
                <small>Wednesday, to HDFC ••2680</small>
              </span>
            </span>
            <span className="sell-tag sell-t2">
              <i>
                <Icon name="bag" />
              </i>
              <span>
                New order
                <small>Gurugram · ₹698</small>
              </span>
            </span>
          </div>
        </div>
      </section>

      <div className="wrap sell-proof">
        <div className="sell-proof-in">
          <div>
            <b>{stats.brands}+</b>
            <span>beauty brands on the store</span>
          </div>
          <div>
            <b>{stats.products.toLocaleString("en-IN")}</b>
            <span>products live right now</span>
          </div>
          <div>
            <b>{COMMISSION}%</b>
            <span>flat commission, nothing else</span>
          </div>
          <div>
            <b>Weekly</b>
            <span>payouts, every Wednesday</span>
          </div>
        </div>
      </div>

      <div className="wrap">
        <section className="sell-sec sell-anchor" id="why" aria-labelledby="why-h">
          <div className="sell-sh">
            <div>
              <span className="sell-eyebrow">Why sell with us</span>
              <h2 id="why-h">A beauty marketplace that sends you buyers, not browsers</h2>
              <p>Built around one idea: shoppers who get a free gift they chose come back — and bring their baskets with them.</p>
            </div>
          </div>
          <div className="sell-why">
            {WHY.map((w) => (
              <article key={w.title} className="sell-card">
                <span className="sell-card-ic">
                  <Icon name={w.icon} />
                </span>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sell-sec sell-anchor" id="how" aria-labelledby="how-h">
          <div className="sell-sh">
            <div>
              <span className="sell-eyebrow">How it works</span>
              <h2 id="how-h">From application to first payout in about a week</h2>
            </div>
            <Link href="/seller/register" className="btn btn-dark">
              Start your application <Icon name="arrow" />
            </Link>
          </div>
          <ol className="sell-how">
            {STEPS.map((s) => (
              <li key={s.t}>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <small>{s.s}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="sell-sec sell-anchor" id="fees" aria-labelledby="fees-h">
          <div className="sell-sh">
            <div>
              <span className="sell-eyebrow">Fees</span>
              <h2 id="fees-h">One simple rate. Everything else is free.</h2>
              <p>You only pay when you sell — and only on items that are delivered.</p>
            </div>
          </div>
          <div className="sell-fees">
            <table className="sell-tbl">
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col">You pay</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    Commission<small>On the selling price of each delivered item</small>
                  </th>
                  <td>
                    <b>{COMMISSION}%</b>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Registration &amp; listing<small>Unlimited products</small>
                  </th>
                  <td>
                    <span className="free">FREE</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Payment collection<small>UPI, cards, net banking and cash on delivery</small>
                  </th>
                  <td>
                    <span className="free">FREE</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Fixed / closing fee<small>Charged per order by many marketplaces</small>
                  </th>
                  <td>
                    <span className="free">NONE</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Free gifts in every order<small>Packed and shipped by The Big Brands</small>
                  </th>
                  <td>
                    <span className="free">ON US</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Sponsored products<small>Optional — top of search and product pages</small>
                  </th>
                  <td>
                    From <b>{formatINR(cpc)}</b> per click
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Payouts<small>To your bank account by NEFT / IMPS</small>
                  </th>
                  <td>
                    Weekly, <b>free</b>
                  </td>
                </tr>
              </tbody>
            </table>
            <EarnCalc commissionPct={COMMISSION} />
          </div>
        </section>

        <section className="sell-sec" aria-label="Requirements and ad tools">
          <div className="sell-two">
            <div className="sell-box">
              <span className="sell-eyebrow">What you need</span>
              <h3>Have these ready and you&apos;ll be done in five minutes</h3>
              <ul className="sell-list">
                <li>
                  <Icon name="check" />
                  <span>
                    <b>GSTIN</b> — your 15-character GST number
                  </span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>
                    <b>Business PAN</b> — the one inside your GSTIN
                  </span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>
                    <b>Bank account</b> in the business&apos;s name, with IFSC
                  </span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>
                    <b>Pickup address</b> for courier collection
                  </span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>
                    <b>Brand authorisation</b> for each brand you sell
                  </span>
                </li>
              </ul>
            </div>
            <div className="sell-box sell-pz">
              <span className="sell-eyebrow">Ad tools</span>
              <h3>Jump to the top of search with Sponsored products</h3>
              <p>
                Choose a live product, a budget and dates — it shows as a clearly labelled “Sponsored” card in search results or on related product pages. From {formatINR(cpc)} a click; never pay for views.
              </p>
              <div className="sell-pz-demo" aria-hidden="true">
                <div className="on">
                  <i />
                  <small>Sponsored</small>
                  <u />
                  <u />
                </div>
                <div>
                  <i />
                  <u />
                  <u />
                </div>
                <div>
                  <i />
                  <u />
                  <u />
                </div>
              </div>
              <Link href="/advertise" className="link">
                Brands: see every ad placement <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </section>

        <section className="sell-sec sell-anchor" id="faq" aria-labelledby="faq-h">
          <div className="sell-sh">
            <div>
              <span className="sell-eyebrow">FAQ</span>
              <h2 id="faq-h">Questions sellers ask us</h2>
            </div>
          </div>
          <div className="sell-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="chevDown" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="sell-cta" aria-labelledby="cta-h">
          <div>
            <h2 id="cta-h">Ready to reach India&apos;s beauty shoppers?</h2>
            <p>Apply in five minutes. Questions first? Write to {site.sellerEmail}.</p>
          </div>
          <Link href="/seller/register" className="btn btn-light btn-lg">
            Start selling <Icon name="arrow" />
          </Link>
        </section>
      </div>
    </div>
  );
}
