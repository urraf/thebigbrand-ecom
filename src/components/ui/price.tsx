import { discountPct, formatINR } from "@/lib/money";
import { cx } from "./cx";

type PriceProps = {
  price: number;
  mrp?: number | null;
  /** large buy-box variant (`.price-big`) */
  big?: boolean;
  /** hide the "M.R.P:" strike + % off */
  hideMrp?: boolean;
  className?: string;
};

/** Price block — ₹ superscript, M.R.P strike and % off (`.price` in theme.css). Shared component. */
export function Price({ price, mrp, big, hideMrp, className }: PriceProps) {
  const off = mrp ? discountPct(mrp, price) : 0;
  return (
    <div className={cx("price", big && "price-big", className)}>
      <span className="pr">
        <sup>₹</sup>
        {Math.round(price).toLocaleString("en-IN")}
      </span>
      {!hideMrp && mrp && mrp > price ? (
        <>
          <span className="mrp">
            M.R.P: <s>{formatINR(mrp)}</s>
          </span>
          <span className="off">({off}% off)</span>
        </>
      ) : null}
    </div>
  );
}
