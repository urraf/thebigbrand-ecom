import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export default function ConsoleNotFound() {
  return (
    <div className="blk am-empty">
      <Icon name="search" />
      <b>We couldn&apos;t find that</b>
      <p>The order, product or customer may have been removed, or the link is mistyped.</p>
      <Link className="btn btn-dark btn-sm" href="/admin">
        Back to dashboard
      </Link>
    </div>
  );
}
