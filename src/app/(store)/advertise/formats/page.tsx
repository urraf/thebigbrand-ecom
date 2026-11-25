import type { Metadata } from "next";
import Link from "next/link";
import { AdZone } from "@/components/ads";
import { Icon } from "@/components/ui/icon";
import { listSlotCards } from "@/server/ads/slots";
import "@/styles/ads/advertise.css";

export const metadata: Metadata = {
  title: "Ad formats, live",
  description: "Every paid placement on The Big Brands, rendered exactly as shoppers see it right now.",
};

const GROUPS: { title: string; page: string; codes: string[] }[] = [
  { title: "Homepage", page: "home", codes: ["H1", "H2", "H4", "H3", "H10", "H5", "H6", "H8", "H9", "H11", "H7"] },
  { title: "Search results", page: "search", codes: ["S2", "H4", "S4", "S3"] },
  { title: "Product page", page: "product", codes: ["P2", "P1"] },
  { title: "Cart & order confirmation", page: "checkout", codes: ["C1", "C2"] },
];

/** Narrow placements are shown at their real width. */
function Narrow({ code }: { code: string }) {
  if (code === "S4") {
    return (
      <div className="wrap zf-narrow zf-s4">
        <AdZone code="S4" />
      </div>
    );
  }
  if (code === "P2") {
    return (
      <div className="wrap zf-narrow zf-p2">
        <AdZone code="P2" />
      </div>
    );
  }
  if (code === "S2") {
    return (
      <div className="wrap zf-narrow">
        <AdZone code="S2" context={{ query: "serum" }} />
      </div>
    );
  }
  if (code === "C2") {
    return (
      <div className="wrap zf-narrow zf-c2">
        <AdZone code="C2" />
      </div>
    );
  }
  if (code === "H4") {
    return (
      <div className="wrap zf-narrow">
        <AdZone code="H4" context={{ concern: "acne" }} />
      </div>
    );
  }
  if (code === "C1") {
    return (
      <div className="wrap zf-narrow">
        <AdZone code="C1" cartSubtotal={780} nextGiftAt={{ minAmount: 999, giftCount: 2 }} />
      </div>
    );
  }
  if (code === "S3" || code === "P1") {
    return (
      <div className="wrap zf-narrow">
        <AdZone code={code} />
      </div>
    );
  }
  if (code === "H10") {
    return (
      <section className="wrap zn-sec">
        <AdZone code="H10" />
      </section>
    );
  }
  return <AdZone code={code} />;
}

export default async function AdFormatsPage() {
  const slots = await listSlotCards();
  const byCode = new Map(slots.map((s) => [s.code, s]));
  return (
    <div className="zf">
      <section className="zf-hero">
        <div className="wrap zf-hero-in">
          <nav className="zf-crumb" aria-label="Breadcrumb">
            <Link href="/advertise">Advertise with us</Link>
            <Icon name="chevRight" />
            <span aria-current="page">Ad formats, live</span>
          </nav>
          <h1>Every placement, exactly as shoppers see it</h1>
          <p>These are the live creatives serving right now. Switch on <b>Show ad slots</b> (bottom-left) to see each placement&rsquo;s code, size and rate.</p>
          <div className="zf-ctas">
            <Link className="btn btn-cart btn-lg" href="/advertise#av-book">
              Book a campaign <Icon name="arrow" />
            </Link>
            <Link className="btn btn-lg av-btn-o" href="/advertise#av-ratecard">
              <Icon name="tag" />
              Rate card
            </Link>
          </div>
        </div>
      </section>
      {GROUPS.map((g) => (
        <div key={g.page} className="zf-grp">
          <div className="wrap zf-grp-h">
            <h2>{g.title}</h2>
          </div>
          {g.codes.map((code) => {
            const s = byCode.get(code);
            if (!s) return null;
            const label = g.page === "search" && code === "H4" ? `${s.name} · on a concern page` : s.name;
            return (
              <div key={code} className="zf-item">
                <div className="wrap zf-label">
                  <span className="av-id">{code}</span>
                  <b>{label}</b>
                  <small>
                    {s.size} · {s.rateLabel} · {s.live} live{!s.isActive ? " · paused" : ""}
                  </small>
                  {s.bookable ? (
                    <Link className="zf-book" href={`/advertise?slot=${code}#av-book`}>
                      Book {code} <Icon name="arrow" />
                    </Link>
                  ) : null}
                </div>
                {g.page === "home" && code === "H4" ? <AdZone code="H4" /> : <Narrow code={code} />}
              </div>
            );
          })}
        </div>
      ))}
      <div className="wrap zf-foot">
        <p>
          Paused or unsold placements don&rsquo;t render on the store. Questions? <a href="mailto:ads@thebigbrands.co.in">ads@thebigbrands.co.in</a>
        </p>
      </div>
    </div>
  );
}
