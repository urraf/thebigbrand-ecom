"use client";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { activeNavItem } from "./nav-match";

/** Top-bar location: "Store › Orders › TBB2611240001" (derived from the URL + ADMIN_NAV). */
export function Crumb() {
  const pathname = usePathname();
  const hit = activeNavItem(pathname);
  const rest = hit ? pathname.slice(hit.item.href.length).split("/").filter(Boolean) : [];
  const tail = rest[0] ? decodeURIComponent(rest[0]) : null;
  const tailLabel = tail === "new" ? "New" : tail && /^c[a-z0-9]{20,}$/i.test(tail) ? "Details" : tail;
  return (
    <div className="am-crumb" aria-label="You are here">
      {hit ? (
        <>
          <span>{hit.group}</span>
          <Icon name="chevRight" />
          {tailLabel ? (
            <>
              <span>{hit.item.label}</span>
              <Icon name="chevRight" />
              <b>{tailLabel}</b>
            </>
          ) : (
            <b>{hit.item.label}</b>
          )}
        </>
      ) : (
        <b>Admin console</b>
      )}
    </div>
  );
}
