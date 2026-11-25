"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart, useStore } from "@/components/cart/cart-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cx } from "@/components/ui/cx";

const LINKS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/account", label: "Overview", icon: "home", exact: true },
  { href: "/account/orders", label: "Your orders", icon: "box" },
  { href: "/account/addresses", label: "Addresses", icon: "pin" },
  { href: "/account/wishlist", label: "Wishlist", icon: "heart" },
  { href: "/account/profile", label: "Profile & security", icon: "user" },
];

/** Account sidebar (desktop) / scrollable tabs (mobile) with the active section highlighted. */
export function AccountNav() {
  const path = usePathname();
  const { user } = useStore();
  return (
    <nav className="cm-acc-nav" aria-label="Your account">
      <div className="cm-acc-hi">
        <span className="cm-acc-av" aria-hidden="true">
          {(user?.firstName ?? "You").slice(0, 1).toUpperCase()}
        </span>
        <span>
          <small>Hello,</small>
          <b>{user?.firstName ?? "there"}</b>
        </span>
      </div>
      <ul>
        {LINKS.map((l) => {
          const on = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link href={l.href} className={cx(on && "is-on")} aria-current={on ? "page" : undefined}>
                <Icon name={l.icon} />
                {l.label}
              </Link>
            </li>
          );
        })}
        <li className="cm-acc-out">
          <SignOutButton />
        </li>
      </ul>
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
        } catch {
          /* the cookie is cleared server-side; navigate anyway */
        }
        await refresh();
        toast("You've been signed out", { icon: "check" });
        router.replace("/");
        router.refresh();
      }}
    >
      <Icon name="logout" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
