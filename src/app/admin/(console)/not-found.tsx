import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { LostArt } from "@/components/ui/lost-art";

export default function ConsoleNotFound() {
  return (
    <div className="blk am-empty am-nf">
      <LostArt compact />
      <b>We couldn&apos;t find that</b>
      <p>The order, product or customer may have been removed, or the link is mistyped. Try the search bar above.</p>
      <div className="am-nf-act">
        <Link className="btn btn-dark btn-sm" href="/admin">
          <Icon name="grid" /> Back to dashboard
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/admin/orders">
          <Icon name="box" /> Orders
        </Link>
      </div>
    </div>
  );
}
