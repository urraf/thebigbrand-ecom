import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import "@/styles/legal/legal.css";

export const HELP_PAGES: { href: string; label: string; icon: IconName }[] = [
  { href: "/help", label: "Help centre", icon: "info" },
  { href: "/contact", label: "Contact us", icon: "phone" },
  { href: "/shipping", label: "Shipping & delivery", icon: "truck" },
  { href: "/returns", label: "Cancellation, returns & refunds", icon: "ret" },
  { href: "/terms", label: "Terms of use", icon: "shield" },
  { href: "/privacy", label: "Privacy policy", icon: "eye" },
];

/**
 * Frame for the help & policy pages: page title, "last updated", an on-page contents list (desktop sidebar,
 * collapsible on phones) and links to the other policies. Sections are plain <section id=…> children.
 */
export function LegalShell({
  current,
  kicker,
  title,
  intro,
  updated,
  toc,
  children,
  wide,
}: {
  current: string;
  kicker?: string;
  title: string;
  intro?: ReactNode;
  updated?: string;
  toc?: { id: string; label: string }[];
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="lg wrap">
      <nav className="lg-crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link href="/help">Help</Link>
        {current !== "/help" ? (
          <>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{title}</span>
          </>
        ) : null}
      </nav>
      <header className="lg-head">
        {kicker ? <span className="lg-kick">{kicker}</span> : null}
        <h1>{title}</h1>
        {intro ? <div className="lg-intro">{intro}</div> : null}
        {updated ? <p className="lg-upd">Last updated {updated}</p> : null}
      </header>
      <div className={wide ? "lg-body lg-wide" : "lg-body"}>
        <aside className="lg-side">
          {toc?.length ? (
            <details className="lg-toc" open>
              <summary>On this page</summary>
              <ol>
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`}>{t.label}</a>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          <nav className="lg-pol" aria-label="Help and policies">
            <h2>Help &amp; policies</h2>
            {HELP_PAGES.map((p) => (
              <Link key={p.href} href={p.href} prefetch={false} aria-current={p.href === current ? "page" : undefined}>
                <Icon name={p.icon} />
                {p.label}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="lg-doc">{children}</article>
      </div>
    </div>
  );
}

/** Numbered policy section with an anchor. */
export function Sec({ id, n, title, children }: { id: string; n?: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="lg-sec" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>
        {n ? <span className="lg-n">{n}.</span> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Highlighted summary box ("The short version"). */
export function Gist({ title = "The short version", items }: { title?: string; items: ReactNode[] }) {
  return (
    <div className="lg-gist">
      <b>
        <Icon name="sparkle" />
        {title}
      </b>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
