/** Loading placeholder for account pages (shown while the per-user content streams in). */
export function AccSkeleton() {
  return (
    <div className="cm-acc-sk" aria-busy="true" aria-label="Loading">
      <div className="cm-sk cm-sk-hero" />
      <div className="cm-sk cm-sk-block" />
    </div>
  );
}
