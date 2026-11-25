import { Icon } from "@/components/ui/icon";
import { SLink } from "@/components/seller/link";

export default function SellerNotFound() {
  return (
    <div className="sl-body">
      <div className="sl-card sl-empty">
        <Icon name="search" />
        <b>We couldn’t find that</b>
        <p>It may have been removed, or it belongs to another seller account.</p>
        <SLink href="/seller" className="btn btn-dark">
          Back to dashboard
        </SLink>
      </div>
    </div>
  );
}
