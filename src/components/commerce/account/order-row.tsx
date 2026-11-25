import Link from "next/link";
import { formatINR } from "@/lib/money";
import type { OrderListItem } from "@/server/checkout/types";
import { Icon } from "@/components/ui/icon";
import { plural, shortDate, STATUS_LABEL } from "../api";
import { SnapArt, StatusPill } from "../parts";

/** One order in "Your orders" / the account overview. Server Component. */
export function OrderRow({ o }: { o: OrderListItem }) {
  const when = o.placedAt ?? o.createdAt;
  return (
    <li className="cm-or">
      <Link href={`/account/orders/${o.number}`} className="cm-or-l" prefetch={false}>
        <span className="cm-or-thumbs" aria-hidden="true">
          {o.thumbs.slice(0, 3).map((t, i) => (
            <SnapArt key={i} name={t.name} brandName={t.brandName} imageUrl={t.imageUrl} art={{ shape: t.shape, c1: t.c1, c2: t.c2 }} className="cm-or-art" sizes="56px" />
          ))}
          {o.thumbs.length > 3 ? <span className="cm-or-more">+{o.thumbs.length - 3}</span> : null}
        </span>
        <span className="cm-or-b">
          <span className="cm-or-top">
            <b>#{o.number}</b>
            <StatusPill status={o.status} label={STATUS_LABEL[o.status] ?? o.status} />
          </span>
          <span className="cm-or-names">{o.thumbs.map((t) => t.name).join(" · ")}</span>
          <small>
            {shortDate(when)} · {plural(o.itemCount, "item")}
            {o.giftCount ? ` + ${plural(o.giftCount, "free gift")}` : ""} · {o.paymentMethod === "COD" ? "Cash on delivery" : o.paymentStatus === "PAID" ? "Paid online" : o.paymentStatus === "REFUNDED" ? "Refunded" : "Not paid"}
          </small>
        </span>
        <span className="cm-or-p">
          <b>{formatINR(o.total)}</b>
          <span className="cm-or-go">
            {o.status === "PENDING_PAYMENT" ? "Pay now" : "Details"} <Icon name="chevRight" />
          </span>
        </span>
      </Link>
    </li>
  );
}
