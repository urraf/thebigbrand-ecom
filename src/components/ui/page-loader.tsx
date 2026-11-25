import "@/styles/loader.css";

/** Branded page loader: pulsing "tbb" tile with an orbiting dot, plus optional shimmering skeleton rows/cards. */
export function PageLoader({ label = "Loading…", cards = 0, rows = 0, dark = false }: { label?: string; cards?: number; rows?: number; dark?: boolean }) {
  return (
    <div className={dark ? "pl pl-dark" : "pl"} role="status" aria-live="polite">
      <div className="pl-mark" aria-hidden="true">
        <i>tbb</i>
        <span className="pl-orbit" />
      </div>
      <span className="pl-label">{label}</span>
      {cards ? (
        <div className="pl-cards" aria-hidden="true">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="pl-card">
              <span className="pl-sk pl-img" />
              <span className="pl-sk pl-l1" />
              <span className="pl-sk pl-l2" />
            </div>
          ))}
        </div>
      ) : null}
      {rows ? (
        <div className="pl-rows" aria-hidden="true">
          {Array.from({ length: rows }, (_, i) => (
            <span key={i} className="pl-sk pl-row" style={{ width: `${92 - ((i * 17) % 30)}%` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
