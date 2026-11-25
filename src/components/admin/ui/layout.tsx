/**
 * Layout primitives for admin pages — no hooks, usable from Server and Client Components.
 * PageHeader · Card · StatGrid/StatCard · KpiCard · EmptyState · Skeletons · KeyValues
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";

export function PageHeader({
  title,
  sub,
  back,
  actions,
  badge,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="am-ph">
      <div className="am-ph-t">
        {back ? (
          <Link className="am-ph-back" href={back.href}>
            <Icon name="chevLeft" />
            {back.label}
          </Link>
        ) : null}
        <h1>
          {title}
          {badge}
        </h1>
        {sub ? <div className="am-hsub">{sub}</div> : null}
      </div>
      {actions ? <div className="am-ph-a">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  sub,
  actions,
  children,
  className,
  id,
  style,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
}) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section className={cx("blk am-card", className)} id={id} aria-labelledby={title ? hid : undefined} style={style}>
      {title || actions ? (
        <header className="am-card-h">
          <div>
            {title ? <h2 id={hid}>{title}</h2> : null}
            {sub ? <div className="am-hsub">{sub}</div> : null}
          </div>
          {actions ? <div className="am-hbtns">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatGrid({ children, cols, label }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; label?: string }) {
  return (
    <section className="am-stats" aria-label={label} style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  unit,
  sub,
  href,
  tone,
  meter,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  href?: string;
  tone?: "cta" | "crit" | "warn";
  /** 0..1 progress meter under the value */
  meter?: number;
}) {
  const body = (
    <>
      <small>{label}</small>
      <b>
        {value}
        {unit ? <em>{unit}</em> : null}
      </b>
      {meter != null ? (
        <div className="am-meter" style={{ "--p": Math.max(0, Math.min(1, meter)).toFixed(3) } as CSSProperties}>
          <i />
        </div>
      ) : null}
      {sub ? <span>{sub}</span> : null}
    </>
  );
  const cls = cx("am-stat", tone && `am-stat-${tone}`);
  return href ? (
    <Link className={cls} href={href}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Delta({ value, suffix = "", label }: { value: number | null; suffix?: string; label?: ReactNode }) {
  if (value == null || !Number.isFinite(value)) return label ? <div className="am-delta"><span>{label}</span></div> : null;
  const up = value >= 0;
  return (
    <div className="am-delta">
      <b className={up ? undefined : "dn"}>
        <Icon name="chevDown" className="am-delta-ic" style={{ transform: up ? "rotate(180deg)" : undefined }} />
        {Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
        {suffix}
      </b>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  sub,
  href,
  hero,
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  sub?: ReactNode;
  href?: string;
  hero?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="am-kpi-l">{label}</div>
      <div className={hero ? "am-hero-v" : "am-kpi-v"}>{value}</div>
      {delta}
      {children}
      {sub ? <small className="am-kpi-s">{sub}</small> : null}
    </>
  );
  const cls = cx("am-kpi", hero && "am-kpi-hero", href && "am-kpi-link", className);
  return href ? (
    <Link className={cls} href={href}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}

export function EmptyState({
  icon = "info",
  title,
  children,
  action,
  ok,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  ok?: boolean;
}) {
  return (
    <div className={cx("am-empty", ok && "ok")}>
      <Icon name={icon} />
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function KeyValues({ rows }: { rows: Array<[ReactNode, ReactNode] | null | false> }) {
  return (
    <dl className="am-kvs">
      {rows.filter(Boolean).map((r, i) => {
        const [k, v] = r as [ReactNode, ReactNode];
        return (
          <div className="am-kv" key={i}>
            <dt>{k}</dt>
            <dd>{v ?? "—"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Loading placeholders used as <Suspense> fallbacks. */
export function SkeletonStats({ n = 4 }: { n?: number }) {
  return (
    <div className="am-stats" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="am-sk am-sk-card" style={{ height: 96 }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="blk am-card" aria-busy="true" aria-label="Loading">
      {title ? <span className="am-sk am-sk-t" /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="am-sk am-sk-row" />
      ))}
    </div>
  );
}

export function SkeletonPage({ stats = 4, rows = 8 }: { stats?: number; rows?: number }) {
  return (
    <>
      {stats ? <SkeletonStats n={stats} /> : null}
      <SkeletonTable rows={rows} />
    </>
  );
}
