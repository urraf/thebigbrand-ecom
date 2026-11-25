import { Icon } from "@/components/ui/icon";
import { LostArt } from "@/components/ui/lost-art";
import { SLink } from "@/components/seller/link";

export default function SellerNotFound() {
  return (
    <div className="sl-body">
      <div className="sl-card sl-empty sl-nf">
        <LostArt compact />
        <b>We couldn’t find that</b>
        <p>It may have been removed, or it belongs to another seller account.</p>
        <div className="sl-nf-act">
          <SLink href="/seller" className="btn btn-dark">
            <Icon name="grid" /> Back to dashboard
          </SLink>
          <SLink href="/seller/orders" className="btn btn-ghost">
            <Icon name="box" /> Orders
          </SLink>
        </div>
      </div>
    </div>
  );
}
