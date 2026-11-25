import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { requireAdminPage } from "@/lib/auth";
import { compactINR, formatINR } from "@/lib/money";
import { getGiftsAdmin, LOW_GIFT_STOCK } from "@/server/admin/core/gifts";
import { GiftEditor, RestockButton, TierEditor } from "@/components/admin/core/gift-admin";
import { ApiSwitch, EmptyState, PageHeader, SkeletonPage, pct } from "@/components/admin/ui";
import { ProductImage } from "@/components/ui/product-image";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Free gifts" };

async function Gifts() {
  await requireAdminPage("/admin/gifts");
  const d = await getGiftsAdmin();
  const active = d.items.filter((g) => g.isActive).length;
  const maxStock = Math.max(700, ...d.items.map((g) => g.stock));
  return (
    <>
      <section className="am-gift-hero">
        <div className="am-gift-hero-t">
          <span className="am-eyebrow">
            <Icon name="gift" />
            Your brand-promotion engine
          </span>
          <h2>Every order ships with a free TBB Originals mini — chosen by the customer before payment.</h2>
          <p>
            Customers try your own label alongside the big brands.{" "}
            {d.funnel.customers ? `${pct(d.funnel.rate, 1)} of them have come back for the full size.` : "Conversion shows here once gifts start shipping."}
          </p>
        </div>
        <div className="am-funnel" aria-label="Gift funnel">
          <div>
            <small>Gifts given this month</small>
            <b>{d.funnel.givenMonth.toLocaleString("en-IN")}</b>
          </div>
          <span className="am-funnel-ar" aria-hidden="true">
            <Icon name="arrow" />
          </span>
          <div>
            <small>Customers who tried a mini</small>
            <b>{d.funnel.customers.toLocaleString("en-IN")}</b>
          </div>
          <span className="am-funnel-ar" aria-hidden="true">
            <Icon name="arrow" />
          </span>
          <div>
            <small>Bought the full size</small>
            <b>
              {d.funnel.converted.toLocaleString("en-IN")}
              {d.funnel.revenue ? <em> · {compactINR(d.funnel.revenue)}</em> : null}
            </b>
          </div>
        </div>
      </section>

      <section className="am-sec" aria-labelledby="am-gi-h">
        <div className="am-sec-h">
          <h2 id="am-gi-h">Gift inventory</h2>
          <span className="am-count">
            {active} of {d.items.length} shown at checkout
          </span>
          <span style={{ marginLeft: "auto" }}>
            <GiftEditor trigger="new" products={d.ownProducts} />
          </span>
          <p>Switch a gift off and it disappears from checkout on the website &amp; app instantly. Stock drops by one each time a shopper picks it.</p>
        </div>
        {d.items.length ? (
          <div className="am-gifts">
            {d.items.map((g) => {
              const low = g.stock < LOW_GIFT_STOCK;
              return (
                <article key={g.id} className={`blk am-gift${g.isActive ? "" : " is-off"}${low ? " is-low" : ""}`}>
                  <ProductImage className="am-gift-art" sizes="96px" product={{ name: g.product.name, image: g.product.image, art: g.product.art, isOwnLabel: true, brand: g.product.brand }} />
                  <div className="am-gift-b">
                    <div className="am-gift-top">
                      <div>
                        <b>{g.miniName}</b>
                        <small>
                          {g.miniSize} · worth {formatINR(g.worth)}
                        </small>
                      </div>
                      <ApiSwitch
                        checked={g.isActive}
                        url={`/api/v1/admin/gifts/${g.id}`}
                        field="isActive"
                        label={`${g.miniName}: ${g.isActive ? "shown at checkout" : "hidden from checkout"}`}
                        successOn={`${g.miniName} is back at checkout`}
                        successOff={`${g.miniName} hidden from checkout`}
                      />
                    </div>
                    <div className="am-stock">
                      <div className="am-stock-n">
                        <b className="num">{g.stock.toLocaleString("en-IN")}</b> minis in stock{" "}
                        {g.stock === 0 ? (
                          <span className="am-low">
                            <Icon name="info" />
                            Out of stock
                          </span>
                        ) : low ? (
                          <span className="am-low">
                            <Icon name="info" />
                            Low stock
                          </span>
                        ) : (
                          <span className="am-ok">
                            <Icon name="check" />
                            In stock
                          </span>
                        )}
                      </div>
                      <div className={`am-meter am-meter-stock${low ? " crit" : ""}`} style={{ "--p": Math.min(1, g.stock / maxStock).toFixed(3) } as CSSProperties}>
                        <i />
                      </div>
                    </div>
                    <ul className="am-gift-m">
                      <li>
                        <b>{pct(g.pickShare)}</b>
                        <span>of picks this month ({g.givenMonth})</span>
                      </li>
                      <li>
                        <b>{g.customers ? pct(g.conversion, 1) : "—"}</b>
                        <span>bought full size ({g.converted}/{g.customers})</span>
                      </li>
                      <li>
                        <b>{formatINR(g.product.price)}</b>
                        <span>
                          <Link href={`/admin/products/${g.product.id}`}>full size</Link>
                        </span>
                      </li>
                    </ul>
                    <div className="am-gift-act">
                      <RestockButton id={g.id} name={g.miniName} low={low} />
                      <GiftEditor trigger="edit" gift={g} products={d.ownProducts} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="blk">
            <EmptyState icon="gift" title="No gifts yet" action={<GiftEditor trigger="new" products={d.ownProducts} />}>
              Add a mini of a TBB Originals product — every order needs at least one gift to choose from.
            </EmptyState>
          </div>
        )}
      </section>

      <TierEditor tiers={d.tiers.map((t) => ({ minAmount: t.minAmount, giftCount: t.giftCount }))} activeGifts={active} key={d.tiers.map((t) => `${t.minAmount}:${t.giftCount}`).join(",")} />
    </>
  );
}

export default function GiftsPage() {
  return (
    <>
      <PageHeader title="Free gifts" sub="TBB Originals minis, their stock and the tier rules shoppers see at checkout." />
      <Suspense fallback={<SkeletonPage stats={0} rows={8} />}>
        <Gifts />
      </Suspense>
    </>
  );
}
