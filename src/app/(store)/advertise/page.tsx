import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import { PzBadge } from "@/components/ui/pz-slot";
import { AvButton } from "@/components/ads/advertise/av-button";
import { BookingForm } from "@/components/ads/advertise/booking";
import { CountUp } from "@/components/ads/advertise/count-up";
import { Estimator } from "@/components/ads/advertise/estimator";
import { FormatsGallery } from "@/components/ads/advertise/formats";
import { HeroVisual, Spark } from "@/components/ads/advertise/hero-visual";
import { AvNav } from "@/components/ads/advertise/nav";
import { BoxArt } from "@/components/ads/advertise/schematic";
import { fmt, GROUPS, grpOf, nf, salesMail } from "@/components/ads/advertise/shared";
import { MODEL_LONG } from "@/components/ads/lib/pricing";
import { getAudienceStats } from "@/server/ads/audience";
import { getAvailability, getBookableBrands, getFestWindows, getRecentBookings, getSearchVolume30d, getTodayIso, getTopResults } from "@/server/ads/advertise";
import { getServedAds } from "@/server/ads/serve";
import { listSlotCards } from "@/server/ads/slots";
import { site } from "@/lib/site";
import "@/styles/ads/zones.css";
import "@/styles/ads/advertise.css";

export const metadata: Metadata = {
  title: "Advertise with us",
  description: "Put your brand in front of India’s beauty shoppers — billboards, sponsored search, shoppable reels and in-box sampling. Self-serve booking, live reporting.",
};

const FAQ: [string, string][] = [
  ["How do I pay?", "You pay securely when you book — UPI, cards or net banking through Razorpay — and get a GST invoice. Fixed-price placements are billed for the days you book. Performance formats (CPM/CPC) are capped at your budget and billed on actual delivery. If our team can’t approve your ad, the full amount is refunded."],
  ["How long does approval take?", "Within 24 working hours. Our team checks your creative and landing page in Ads Manager and you get an email when the campaign is approved and again when it goes live. Most campaigns booked before 4 pm are approved the same day."],
  ["What are the creative guidelines?", "Headlines up to 48 characters and sub-lines up to 70. Ads must follow ASCI guidelines: no unverified medical or “cures” claims, no before/after images without proof, and no comparisons with named competitors. Advertised products must be listed on The Big Brands. Prefer to design it yourself? Upload a finished banner at the size shown for each placement."],
  ["What reporting do I get?", "Every booking has a live view under My campaigns with impressions, clicks, CTR and spend, updated as shoppers see your ad. Impressions count only when at least half of the ad is on screen for a second, and repeat clicks are filtered out."],
  ["Can I target specific shoppers?", "Search formats target by keyword and skin or hair concern. Sponsored products appear next to related products and in matching searches. Concern sponsorships put your brand on a whole shopping edit. Custom audiences are planned with our partnerships team."],
  ["Can I pause or cancel a campaign?", "Write to us and performance campaigns can be paused at any time. Fixed-price placements cancelled at least 48 hours before the start date get a full credit; after that, unused days are credited at 50%."],
  ["How does in-box sampling work?", "Send your flyers or mini samples to our fulfilment centre. We add them to boxes that match the category you choose, for example every haircare order. The per-box price includes insertion and reporting."],
];

export default async function AdvertisePage() {
  const [slots, stats, h1, h2, h3, s2, s1, brands, availability, recent, results, searches, today, fest] = await Promise.all([
    listSlotCards(),
    getAudienceStats(),
    getServedAds("H1"),
    getServedAds("H2"),
    getServedAds("H3"),
    getServedAds("S2"),
    getServedAds("S1", { query: "serum" }),
    getBookableBrands(),
    getAvailability(),
    getRecentBookings(),
    getTopResults(3),
    getSearchVolume30d(),
    getTodayIso(),
    getFestWindows(),
  ]);
  const byCode = new Map(slots.map((s) => [s.code, s]));
  const rate = (c: string) => byCode.get(c)?.rate ?? 0;
  const aov = stats.aov || 742;
  const proof = brands.slice(0, 7);
  const spItems = (await getServedAds("S3")).flatMap((a) => a.products).slice(0, 3);
  const searchRows = [...(s2[0]?.products.slice(0, 1) ?? []), ...spItems]
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
    .slice(0, 3)
    .map((p) => ({ product: p, sponsored: true }));
  const s1Ad = s1[0];
  const x1 = byCode.get("X1");

  // packages built from today's rate card (10% bundle saving)
  const pkgs = [
    { n: "Starter", t: "Get discovered", was: rate("H3") * 7 + 10000, items: [`Leaderboard Strip · 7 days`, "Search Headline Banner · ₹10,000 of clicks", "Live performance reporting"], slot: "H3", days: 7 },
    { n: "Launch", t: "New product blitz", was: rate("H1") * 7 + rate("H10") + (x1 ? x1.rate * 5000 : 0), items: ["Hero Billboard · 7 days", "Sponsored Deal of the Day · 1 day", "In-box flyer · 5,000 boxes"], slot: "H1", days: 7, hot: true },
    { n: "Always-on", t: "Own a skin concern", was: rate("H4") + rate("B1") + 15000, per: "/month", items: ["Concern Sponsorship · “Presented by”", "Brand Store subscription", "Sponsored Products · ₹15,000 wallet"], sales: true },
  ].map((p) => ({ ...p, price: Math.round((p.was * 0.9) / 100) * 100 }));
  const takeover = Math.round(((rate("H1") * 5 + rate("H2") * 4 + rate("H3") + rate("H10")) * 0.9) / 100) * 100;

  return (
    <div className="av">
      <AvNav />

      <section className="av-hero av-anchor" id="av-top">
        <div className="wrap av-hero-in">
          <div className="av-hero-copy">
            <span className="av-pill">
              <b>New</b>Self-serve ads · reviewed within 24 hours
            </span>
            <h1>
              Put your brand in front of <em>India’s beauty shoppers</em>
            </h1>
            <p className="av-lead">Billboards, sponsored search, shoppable reels — and a sample in every delivery box. Book in minutes, we approve within a day, and you track every impression and click live.</p>
            <div className="av-ctas">
              <AvButton act={{ type: "jump", target: "av-book" }} className="btn btn-cart btn-lg">
                Book a campaign <Icon name="arrow" />
              </AvButton>
              <AvButton act={{ type: "jump", target: "av-ratecard" }} className="btn btn-lg av-btn-o">
                <Icon name="tag" />
                See rate card
              </AvButton>
            </div>
            <ul className="av-ticks">
              <li>
                <Icon name="check" />
                Pay securely online
              </li>
              <li>
                <Icon name="check" />
                Full refund if not approved
              </li>
              <li>
                <Icon name="check" />
                GST invoice
              </li>
            </ul>
            <div className="av-proof">
              <span>Brands on The Big Brands</span>
              <div className="av-proof-l">
                {proof.map((b) => (
                  <BrandLogo key={b.id} brand={b} size={15} color="rgba(255,255,255,.78)" showSub={false} />
                ))}
              </div>
            </div>
          </div>
          <HeroVisual
            slides={h1.map((a) => ({ id: a.id, isHouse: a.isHouse, kicker: a.kicker, headline: a.headline, cta: a.ctaLabel, theme: a.theme, product: a.products[0] ?? null }))}
            cards={h2.slice(0, 4).map((a) => ({ id: a.id, brand: a.brand, headline: a.headline, theme: a.theme, product: a.products[0] ?? null }))}
            strip={h3[0] ? { brand: h3[0].brand, headline: h3[0].headline, theme: h3[0].theme } : null}
            search={s2[0] ? { brand: s2[0].brand, headline: s2[0].headline, subline: s2[0].subline, rows: searchRows } : null}
            tags={{ H1: byCode.get("H1")?.rateLabel ?? "", H2: byCode.get("H2")?.rateLabel ?? "", S2: byCode.get("S2")?.rateLabel ?? "" }}
            kpi={{ today: stats.impressionsYesterday || stats.impressionsToday, ctr: stats.ctr30d, live: stats.liveCampaigns, daily: stats.daily, clicksToday: stats.impressionsYesterday ? stats.clicksYesterday : stats.clicksToday, label: stats.impressionsYesterday ? "yesterday" : "today" }}
            bookings={recent}
          />
        </div>
      </section>

      <div className="wrap av-body">
        <div className="av-stats">
          <ul className="av-stats-l">
            <li className="av-stat">
              <span className="av-stat-ic">
                <Icon name="eye" />
              </span>
              <CountUp to={stats.impressions30d >= 100000 ? Math.round(stats.impressions30d / 10000) / 10 : stats.impressions30d} dec={stats.impressions30d >= 100000 ? 1 : 0} suf={stats.impressions30d >= 100000 ? "L" : ""} />
              <span>Ad impressions · last 30 days</span>
            </li>
            <li className="av-stat">
              <span className="av-stat-ic">
                <Icon name="box" />
              </span>
              <CountUp to={stats.orders30d} />
              <span>Orders · last 30 days</span>
            </li>
            <li className="av-stat">
              <span className="av-stat-ic">
                <Icon name="bag" />
              </span>
              <CountUp to={aov} pre="₹" />
              <span>Average order value</span>
            </li>
            <li className="av-stat">
              <span className="av-stat-ic">
                <Icon name="store" />
              </span>
              <CountUp to={stats.brands} suf="+" />
              <span>Brands &amp; {nf(stats.products)} products</span>
            </li>
            <li className="av-stat">
              <span className="av-stat-ic">
                <Icon name="pin" />
              </span>
              <CountUp to={stats.cities} />
              <span>Cities we deliver to</span>
            </li>
          </ul>
          <p className="av-stats-note">
            <Icon name="info" />
            Live figures from the store · updated hourly
          </p>
        </div>

        <section className="av-sec av-anchor" id="av-why">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Why The Big Brands</span>
              <h2>Ads that sit exactly where beauty shoppers decide</h2>
              <p>Shoppers come here to buy, not to scroll. Every placement is next to a buying decision — and every order ships in a box people can’t wait to open.</p>
            </div>
          </header>
          <div className="av-why">
            <article className="av-w av-w-intent">
              <span className="av-w-ic">
                <Icon name="target" />
              </span>
              <h3>High-intent shoppers</h3>
              <p>Your ad appears when someone searches “vitamin c serum”, not while they scroll a feed.</p>
              <div className="av-iv" aria-hidden="true">
                <div className="av-iv-q">
                  <Icon name="search" />
                  <span>vitamin c serum</span>
                  <i className="av-caret" />
                </div>
                <div className="av-iv-dd">
                  {s1Ad ? (
                    <div className="av-iv-sp">
                      <PzBadge />
                      {s1Ad.brand ? <BrandLogo brand={s1Ad.brand} size={12} showSub={false} /> : null}
                      <span>{s1Ad.headline}</span>
                    </div>
                  ) : null}
                  <div className="av-iv-row">
                    <Icon name="search" />
                    vitamin c serum for glowing skin
                  </div>
                  <div className="av-iv-row">
                    <Icon name="search" />
                    vitamin c face wash
                  </div>
                </div>
              </div>
              <div className="av-w-stat">
                {searches >= 100 ? (
                  <>
                    <b>{nf(searches)}</b>
                    <span>product and concern searches in the last 30 days</span>
                  </>
                ) : (
                  <>
                    <b>{((byCode.get("S2")?.reach.ctr ?? 0.03) * 100).toFixed(1)}%</b>
                    <span>click-through on the search headline banner</span>
                  </>
                )}
              </div>
            </article>
            <article className="av-w av-w-box">
              <div className="av-wb-copy">
                <span className="av-only">
                  <Icon name="sparkle" />
                  Only on The Big Brands
                </span>
                <h3>Every delivery box is a sampling channel</h3>
                <p>Every order ships with a free TBB gift, so customers open the box with excitement. Put your flyer or a mini sample right next to it — delivered to a verified beauty buyer, at home.</p>
                <div className="av-wb-stats">
                  <div>
                    <b>{nf(stats.orders30d)}</b>
                    <small>boxes · last 30 days</small>
                  </div>
                  <div>
                    <b>~100%</b>
                    <small>opened at home</small>
                  </div>
                  <div>
                    <b>{x1 ? x1.rateLabel.replace("/box", "") : "₹4"}</b>
                    <small>per box, all-in</small>
                  </div>
                </div>
                <AvButton act={{ type: "estimate", slot: "X1" }} className="link">
                  Estimate an in-box campaign <Icon name="arrow" />
                </AvButton>
              </div>
              <div className="av-wb-art">
                <BoxArt className="av-boxart-lg" />
                <span className="av-call av-call-1">Your flyer or sample</span>
                <span className="av-call av-call-2">Free TBB gift inside</span>
              </div>
            </article>
            <article className="av-w av-w-funnel">
              <span className="av-w-ic">
                <Icon name="layers" />
              </span>
              <h3>Full-funnel formats</h3>
              <p>Build awareness on the homepage, win consideration on search and product pages, and close the sale in the cart.</p>
              <div className="av-fun">
                {[
                  ["Awareness", "Be seen", "100%", "#5b35e0", "#8b66ff", ["Hero Billboard", "Video", "Reels", "In-box sample"]],
                  ["Consideration", "Be chosen", "86%", "#d6246b", "#ff3d6e", ["Search banner", "Spotlight cards", "Brand store"]],
                  ["Conversion", "Be bought", "72%", "#ff6a3d", "#ffa53d", ["Sponsored products", "Cart add-ons", "Coupons"]],
                ].map(([l, s, w, c1, c2, chips]) => (
                  <div key={l as string} className="av-fun-r" style={{ "--w": w, "--c1": c1, "--c2": c2 } as CSSProperties}>
                    <span className="av-fun-l">
                      <b>{l as string}</b>
                      <small>{s as string}</small>
                    </span>
                    <div className="av-fun-bar">
                      {(chips as string[]).map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="av-w av-w-report">
              <span className="av-w-ic">
                <Icon name="chart" />
              </span>
              <h3>Transparent reporting</h3>
              <p>Viewable impressions, clicks and spend for every campaign. No black box.</p>
              <div className="av-rep" aria-hidden="true">
                <div className="av-rep-k">
                  <span>
                    <small>Impressions</small>
                    <b>{nf(stats.impressions30d)}</b>
                  </span>
                  <span>
                    <small>CTR</small>
                    <b>{(stats.ctr30d * 100).toFixed(1)}%</b>
                  </span>
                  <span>
                    <small>Live ads</small>
                    <b>{stats.liveCampaigns}</b>
                  </span>
                </div>
                <Spark vals={stats.daily} w={260} h={64} className="av-spark-lg" />
                <div className="av-rep-f">
                  <span>
                    <Icon name="clock" />
                    Last 14 days, all advertisers
                  </span>
                  <span>
                    <Icon name="check" />
                    GST invoice
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="av-sec av-anchor" id="av-formats">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Ad formats</span>
              <h2>{slots.length} placements across the whole shopping journey</h2>
              <p>
                From the first search to the unboxing. The highlighted block in each mock shows exactly where your ad appears —{" "}
                <Link href="/advertise/formats" className="link">
                  see every format live <Icon name="arrow" />
                </Link>
              </p>
            </div>
            <p className="av-legend">
              <span className="av-lg-i">
                <span className="av-tag av-tag-ss">
                  <Icon name="zap" />
                  Self-serve
                </span>
                book instantly below
              </span>
              <span className="av-lg-i">
                <span className="av-tag av-tag-mg">Managed</span>
                set up by our partnerships team
              </span>
            </p>
          </header>
          <FormatsGallery slots={slots} fest={fest} takeover={takeover} />
        </section>

        <section className="av-sec av-anchor" id="av-ratecard">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Rate card · {new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
              <h2>Simple, published prices. No haggling.</h2>
              <p>Fixed-price placements are billed per day, week or month. Performance formats are billed only on delivery: per 1,000 views (CPM) or per click (CPC).</p>
            </div>
            <a className="btn btn-ghost av-sh-btn" href="/api/v1/ads/slots?format=csv" download>
              <Icon name="upload" />
              Download rate card (CSV)
            </a>
          </header>
          <div className="blk av-rc">
            <div className="av-rc-scroll" tabIndex={0} role="region" aria-label="Rate card table, scrolls sideways">
              <table className="av-table" id="av-rates">
                <caption className="sr-only">The Big Brands advertising rate card</caption>
                <thead>
                  <tr>
                    <th scope="col">Placement</th>
                    <th scope="col">Format &amp; size</th>
                    <th scope="col">Pricing model</th>
                    <th scope="col" className="r">
                      Rate
                    </th>
                    <th scope="col" className="r">
                      Est. reach / day
                    </th>
                    <th scope="col" className="r">
                      Effective CPM
                    </th>
                    <th scope="col">Live now</th>
                    <th scope="col" className="r">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => {
                    const list = slots.filter((s) => grpOf(s.page) === g.id);
                    if (!list.length) return null;
                    return [
                      <tr key={g.id} className="av-tg">
                        <th colSpan={8} scope="colgroup">
                          <span>
                            <Icon name={g.ic} />
                            {g.name}
                          </span>
                          <small>
                            {list.length} placement{list.length > 1 ? "s" : ""}
                          </small>
                        </th>
                      </tr>,
                      ...list.map((s) => {
                        const f = Math.round(s.fill * 100);
                        const sold = s.exclusive && f >= 100;
                        const perDay = { DAY: s.rate, WEEK: s.rate / 7, MONTH: s.rate / 30, CPM: (s.reach.imp / 1000) * s.rate, CPC: s.reach.imp * s.reach.ctr * s.rate, CLIP: s.reach.imp * s.reach.ctr * s.rate, BOX: s.reach.imp * s.rate }[s.pricingModel] ?? s.rate;
                        const ecpm = s.reach.imp ? (perDay / s.reach.imp) * 1000 : 0;
                        const impL = s.reach.impL.toLowerCase();
                        return (
                          <tr key={s.code}>
                            <th scope="row">
                              <div className="av-rc-p">
                                <span className="av-id">{s.code}</span>
                                <span className="av-rc-pt">
                                  <b>{s.name}</b>
                                  <small className="av-rc-m">
                                    {s.format} · {s.size}
                                  </small>
                                  <span className="av-rc-mr">
                                    <b>{s.rateLabel}</b>
                                    <span>
                                      ~{nf(s.reach.imp)} {impL.replace("impressions", "views")}/day
                                    </span>
                                    {!s.isActive ? <em className="sold">Paused</em> : sold ? <em className="sold">All positions live</em> : null}
                                  </span>
                                </span>
                              </div>
                            </th>
                            <td>
                              {s.format}
                              <small>{s.size}</small>
                            </td>
                            <td>{MODEL_LONG[s.pricingModel] ?? s.pricingModel}</td>
                            <td className="r">
                              <b className="av-rate">{s.rateLabel}</b>
                            </td>
                            <td className="r">
                              ~{nf(s.reach.imp)}
                              <small>{impL}</small>
                            </td>
                            <td className="r">{s.pricingModel === "BOX" ? s.rateLabel : fmt(ecpm)}</td>
                            <td className="av-rc-fill">
                              <span className={sold ? "av-mini sold" : "av-mini"}>
                                <i style={{ width: `${Math.min(100, f)}%` }} />
                              </span>
                              <small className="av-mini-t">{!s.isActive ? "Paused" : s.exclusive ? `${s.live}/${s.positions}` : `${s.live} running`}</small>
                            </td>
                            <td className="r">
                              {s.bookable ? (
                                <AvButton act={{ type: "pick", slot: s.code }} className="btn btn-cart btn-sm" label={`Book ${s.name}`}>
                                  Book
                                </AvButton>
                              ) : (
                                <a className="btn btn-ghost btn-sm" href={salesMail(`${s.code} · ${s.name} — enquiry`)} aria-label={`Contact sales about ${s.name}`}>
                                  Sales
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <ul className="av-rc-notes">
              <li>
                <Icon name="percent" />
                <span>
                  <b>Volume discount</b> on per-day placements: 10% off 14+ days, 15% off 30+ days
                </span>
              </li>
              <li>
                <Icon name="info" />
                <span>
                  All prices exclude <b>18% GST</b>. Reach is measured from the last 30 days of delivery where available.
                </span>
              </li>
              <li>
                <Icon name="calendar" />
                <span>
                  <b>Festive weeks</b> (Diwali, End of Season Sale) are priced separately, so book early
                </span>
              </li>
            </ul>
          </div>
          <div className="av-pk">
            {pkgs.map((p) => (
              <article key={p.n} className={p.hot ? "av-pk-c hot" : "av-pk-c"}>
                {p.hot ? <span className="av-pk-hot">Most booked</span> : null}
                <span className="av-pk-n">{p.n}</span>
                <h3>{p.t}</h3>
                <div className="av-pk-p">
                  <b>{fmt(p.price)}</b>
                  <small>{p.per ?? ""} + GST</small>
                  <s>{fmt(p.was)}</s>
                </div>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>
                      <Icon name="check" />
                      {i}
                    </li>
                  ))}
                </ul>
                {p.sales || !p.slot ? (
                  <a className={p.hot ? "btn btn-cart" : "btn btn-ghost"} href={salesMail(`${p.n} package — ${p.t}`)}>
                    Talk to partnerships
                  </a>
                ) : (
                  <AvButton act={{ type: "pick", slot: p.slot, days: p.days }} className={p.hot ? "btn btn-cart" : "btn btn-ghost"}>
                    Start with {byCode.get(p.slot)?.name ?? p.slot}
                  </AvButton>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="av-sec av-anchor" id="av-est">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Campaign estimator</span>
              <h2>See what your budget buys before you spend a rupee</h2>
              <p>Pick a placement, then set a duration or a budget. Estimates update as you go.</p>
            </div>
          </header>
          <Estimator slots={slots} aov={aov} today={today} />
        </section>

        <section className="av-sec av-anchor" id="av-book">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Self-serve booking</span>
              <h2>Book a campaign in five minutes</h2>
              <p>Choose a placement and dates, write your ad, and watch the preview update. We review every ad within 24 hours.</p>
            </div>
            <ol className="av-how">
              <li>
                <b>1</b>Book &amp; pay
              </li>
              <li>
                <b>2</b>We approve
              </li>
              <li>
                <b>3</b>You go live
              </li>
            </ol>
          </header>
          <div className="blk av-bk" id="av-bk">
            <BookingForm slots={slots} brands={brands} availability={availability} aov={aov} today={today} />
          </div>
          <p className="av-mine">
            Already booked?{" "}
            <Link href="/advertise/campaigns" className="link">
              See my campaigns <Icon name="arrow" />
            </Link>
          </p>
        </section>

        <section className="av-sec av-anchor" id="av-stories">
          <header className="av-sh">
            <div>
              <span className="av-eyebrow">Results</span>
              <h2>What brands are getting right now</h2>
              <p>Live delivery from campaigns running on The Big Brands — no projections, no sample numbers.</p>
            </div>
          </header>
          {results.length ? (
            <div className="av-stg">
              {results.map((r, i) =>
                i === 0 ? (
                  <article key={r.slotCode} className="av-case">
                    <div className="av-case-h">
                      {r.brand ? <BrandLogo brand={r.brand} size={22} color="#ffd9a8" showSub={false} /> : null}
                      <span className="av-case-tag">
                        {r.slotCode} · {r.slotName}
                      </span>
                    </div>
                    <h3>
                      {(r.ctr * 100).toFixed(1)}% of shoppers who saw the ad clicked it
                    </h3>
                    <p>
                      {nf(r.impressions)} viewable impressions over {r.days} day{r.days > 1 ? "s" : ""}, every one of them next to a buying decision.
                    </p>
                    <div className="av-case-k">
                      <div>
                        <b>{nf(r.impressions)}</b>
                        <small>impressions</small>
                      </div>
                      <div>
                        <b>{nf(r.clicks)}</b>
                        <small>clicks</small>
                      </div>
                      <div>
                        <b>{r.clicks ? fmt(r.spent / r.clicks) : "—"}</b>
                        <small>cost per click</small>
                      </div>
                    </div>
                  </article>
                ) : (
                  <figure key={r.slotCode} className="av-q">
                    {r.brand ? (
                      <span className="av-q-logo">
                        <BrandLogo brand={r.brand} size={20} showSub={false} />
                      </span>
                    ) : null}
                    <div className="av-q-big">
                      <b>{(r.ctr * 100).toFixed(1)}%</b>
                      <span>
                        <Icon name="trending" />
                        click-through on {r.slotName}
                      </span>
                    </div>
                    <blockquote>
                      {nf(r.impressions)} impressions and {nf(r.clicks)} clicks in {r.days} day{r.days > 1 ? "s" : ""} — {r.clicks ? `${fmt(r.spent / r.clicks)} per click` : "billed on delivery"}.
                    </blockquote>
                    <div className="av-q-f">
                      <span className="av-q-camp">
                        <Icon name="megaphone" />
                        {r.slotCode} · {MODEL_LONG[r.pricingModel] ?? r.pricingModel}
                      </span>
                    </div>
                  </figure>
                ),
              )}
            </div>
          ) : (
            <p className="av-sample">
              <Icon name="info" />
              Results appear here once campaigns have delivered.
            </p>
          )}
        </section>

        <section className="av-sec av-anchor" id="av-faq">
          <div className="av-faq">
            <div className="av-faq-l">
              <header className="av-sh">
                <div>
                  <span className="av-eyebrow">FAQ</span>
                  <h2>Questions brands ask us</h2>
                  <p>Everything about payment, approval, creatives and reporting.</p>
                </div>
              </header>
              <div className="av-contact">
                <span className="av-contact-ic">
                  <Icon name="users" />
                </span>
                <b>Prefer to talk to someone?</b>
                <p>Our partnerships team plans festive, launch and always-on campaigns with you.</p>
                <a className="av-mail" href={`mailto:${site.adsEmail}`}>
                  {site.adsEmail}
                </a>
                <small>Mon–Sat · 10 am – 7 pm IST</small>
                <div className="av-contact-b">
                  <a className="btn btn-light btn-sm" href={salesMail("Please call me back about advertising")}>
                    <Icon name="phone" />
                    Request a call back
                  </a>
                  <Link className="btn btn-sm av-btn-o" href="/advertise/formats">
                    <Icon name="eye" />
                    See formats live
                  </Link>
                </div>
              </div>
            </div>
            <div className="av-faq-r">
              {FAQ.map(([q, a], i) => (
                <details key={q} className="av-qa" open={i === 0}>
                  <summary>
                    <span>{q}</span>
                    <i aria-hidden="true">
                      <Icon name="plus" />
                    </i>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
