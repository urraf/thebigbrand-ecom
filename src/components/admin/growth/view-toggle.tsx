"use client";
/**
 * Chart ⇄ table switch for a card (the table is the accessible twin of every chart).
 *   <ChartTableToggle label="Daily revenue" chart={<StackedColumns …/>} table={<DataTable …/>} legend={…} />
 * MetricTabs — one chart per metric (no dual axes): <MetricTabs items={[{ key, label, node }]} />
 */
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export function ChartTableToggle({ label, chart, table, legend }: { label: string; chart: ReactNode; table: ReactNode; legend?: ReactNode }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <>
      <div className="ag-row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <div>{view === "chart" ? legend : null}</div>
        <div className="am-segctl" role="group" aria-label={`Show ${label.toLowerCase()} as`}>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
            <Icon name="chart" />
            Chart
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            <Icon name="grid" />
            Table
          </button>
        </div>
      </div>
      {view === "chart" ? chart : table}
    </>
  );
}

export function MetricTabs({ items, label, aside }: { items: Array<{ key: string; label: string; node: ReactNode }>; label: string; aside?: ReactNode }) {
  const [cur, setCur] = useState(items[0]?.key);
  const active = items.find((i) => i.key === cur) ?? items[0];
  return (
    <>
      <div className="ag-row ag-metric" style={{ justifyContent: "space-between" }}>
        <div className="am-segctl" role="group" aria-label={label}>
          {items.map((i) => (
            <button key={i.key} type="button" aria-pressed={i.key === active?.key} onClick={() => setCur(i.key)}>
              {i.label}
            </button>
          ))}
        </div>
        {aside}
      </div>
      {active?.node}
    </>
  );
}
