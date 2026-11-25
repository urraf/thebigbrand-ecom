import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { SLink } from "./link";

/** Sticky page header for portal pages (static — safe in the prerendered shell). */
export function PageHead({ title, sub, back, actions }: { title: string; sub?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="sl-top">
      <div className="sl-top-t">
        {back ? (
          <SLink href={back.href} className="sl-crumb">
            <Icon name="chevLeft" /> {back.label}
          </SLink>
        ) : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="sl-top-act">{actions}</div> : null}
    </div>
  );
}

/** Loading placeholder that keeps the page frame (used as Suspense fallbacks). */
export function BodySkeleton({ rows = [120, 320, 260] }: { rows?: number[] }) {
  return (
    <div className="sl-body" aria-busy="true" aria-label="Loading">
      <div className="sl-skel">
        {rows.map((h, i) => (
          <i key={i} style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`sl-pill sl-pill-${tone ?? "off"}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
