"use client";
/**
 * Seller Central chrome: desktop sidebar (SELLER_NAV + badges), mobile header, mobile bottom tabs and the
 * "More" sheet. Links are host-aware (bare paths on seller.*). The active item is computed from a normalised
 * pathname ("/orders" on seller.* ≡ "/seller/orders"), so server and client render the same markup.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SELLER_NAV } from "./nav";
import { Icon, type IconName } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useSellerHref } from "./use-seller-href";
import { initials } from "./format";

export type ShellSeller = { displayName: string; logoUrl: string | null; status: string; slug: string; contactName: string } | null;
export type ShellCounts = { orders: number; products: number } | null;

type Props = { seller: ShellSeller; counts: ShellCounts; active: string | null };

export function normalisePortalPath(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname === "/seller" || pathname.startsWith("/seller/")) return pathname;
  return pathname === "/" ? "/seller" : `/seller${pathname}`;
}

function isActive(active: string | null, href: string) {
  if (!active) return false;
  if (href === "/seller") return active === "/seller";
  return active === href || active.startsWith(`${href}/`);
}

const TAB_HREFS = ["/seller", "/seller/orders", "/seller/products", "/seller/payouts"];

function badgeFor(href: string, counts: ShellCounts) {
  if (!counts) return null;
  if (href === "/seller/orders" && counts.orders > 0) return counts.orders;
  if (href === "/seller/products" && counts.products > 0) return counts.products;
  return null;
}

export function SellerShell({ seller, counts, active }: Props) {
  const href = useSellerHref();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  // close the "More" sheet on navigation (adjust state during render — no effect needed)
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setMore(false);
  }

  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.replace(href("/seller/login"));
      router.refresh();
    } catch {
      toast("Couldn't sign out — try again", { icon: "info" });
      setBusy(false);
    }
  }

  const name = seller?.displayName ?? "";
  const tabItems = SELLER_NAV.filter((n) => TAB_HREFS.includes(n.href));
  const moreActive = !TAB_HREFS.some((h) => isActive(active, h)) && !!active;

  return (
    <>
      <aside className="sl-side" aria-label="Seller Central">
        <Link href={href("/seller")} className="sl-logo" aria-label="Seller Central home">
          <span className="logo-mark">
            <i aria-hidden="true">tbb</i>
          </span>
          <span className="sl-logo-t">
            <b>
              thebigbrands<em>.co.in</em>
            </b>
            <small>Seller Central</small>
          </span>
        </Link>
        <div className={seller ? "sl-me" : "sl-me is-loading"}>
          <span className="sl-me-av" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {seller?.logoUrl ? <img src={seller.logoUrl} alt="" /> : initials(name || "Seller")}
          </span>
          <span className="sl-me-t">
            <b>{name}</b>
            {seller ? (
              <small>
                <i aria-hidden="true" /> {seller.status === "APPROVED" ? "Approved seller" : seller.status.toLowerCase()}
              </small>
            ) : null}
          </span>
        </div>
        <nav className="sl-nav" aria-label="Seller menu">
          {SELLER_NAV.map((n) => {
            const on = isActive(active, n.href);
            const b = badgeFor(n.href, counts);
            return (
              <Link key={n.href} href={href(n.href)} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
                <Icon name={n.icon as IconName} />
                {n.label}
                {b ? (
                  <span className="sl-badge" aria-label={`${b} need attention`}>
                    {b}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="sl-app">
          <span className="sl-app-ic">
            <Icon name="phone" />
          </span>
          <b>Seller app — coming soon</b>
          <p>Confirm orders, print labels and track payouts from your phone. Same account, same data.</p>
        </div>
        <div className="sl-side-links">
          <a href={href.store("/sell")}>
            <Icon name="info" /> Seller help &amp; fees <Icon name="arrow" />
          </a>
          <a href={href.store("/")} target="_blank" rel="noopener">
            <Icon name="store" /> Visit the store <Icon name="arrow" />
          </a>
          <button type="button" onClick={logout} disabled={busy}>
            <Icon name="logout" /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <header className="sl-mhead">
        <Link href={href("/seller")} className="logo-mark" aria-label="Seller Central home">
          <i aria-hidden="true">tbb</i>
        </Link>
        <span className="sl-mhead-t">
          <b>{name || "Seller Central"}</b>
          <small>Seller Central</small>
        </span>
        <Link className="ib" href={href("/seller/profile")} aria-label="Business profile">
          <Icon name="user" />
        </Link>
      </header>

      <nav className="sl-tabbar" aria-label="Seller app navigation">
        {tabItems.map((n) => {
          const on = isActive(active, n.href);
          const b = badgeFor(n.href, counts);
          return (
            <Link key={n.href} href={href(n.href)} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
              <Icon name={n.icon as IconName} />
              {n.href === "/seller" ? "Home" : n.label.split(" ")[0]}
              {b ? <span className="sl-badge">{b}</span> : null}
            </Link>
          );
        })}
        <button type="button" className={moreActive ? "on" : undefined} onClick={() => setMore(true)} aria-expanded={more} aria-controls="sl-more">
          <Icon name="menu" />
          More
        </button>
      </nav>
      <div className={more ? "sl-scrim open" : "sl-scrim"} onClick={() => setMore(false)} aria-hidden="true" />
      <div id="sl-more" className={more ? "sl-sheet open" : "sl-sheet"} role="dialog" aria-modal="true" aria-label="More" inert={!more}>
        <div className="sl-sheet-grip" />
        {SELLER_NAV.filter((n) => !TAB_HREFS.includes(n.href)).map((n) => (
          <Link key={n.href} href={href(n.href)} className={isActive(active, n.href) ? "on" : undefined}>
            <Icon name={n.icon as IconName} /> {n.label}
          </Link>
        ))}
        <hr />
        <a href={href.store("/sell")}>
          <Icon name="info" /> Seller help &amp; fees
        </a>
        <a href={href.store("/")}>
          <Icon name="store" /> Visit the store
        </a>
        <button type="button" onClick={logout} disabled={busy}>
          <Icon name="logout" /> {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </>
  );
}

/** Same shell with the live pathname (must render inside <Suspense>: usePathname suspends on dynamic routes). */
export function SellerShellLive(props: Omit<Props, "active">) {
  const active = normalisePortalPath(usePathname());
  return <SellerShell {...props} active={active} />;
}
