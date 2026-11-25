"use client";
import { useState } from "react";
import { useAdminAction } from "@/components/admin/ui";

/** Inline stock editor for product tables: type a number, Enter/blur saves via PATCH { stock }. */
export function StockCell({ id, stock, low = 10, url }: { id: string; stock: number; low?: number; url?: string }) {
  const [val, setVal] = useState(String(stock));
  const [seen, setSeen] = useState(stock);
  const { run, busy } = useAdminAction();
  if (stock !== seen) {
    setSeen(stock);
    setVal(String(stock));
  }
  const n = Number(val);
  const tone = stock <= 0 ? "crit" : stock <= low ? "warn" : "";
  async function save() {
    if (!Number.isInteger(n) || n < 0) {
      setVal(String(stock));
      return;
    }
    if (n === stock) return;
    const ok = await run(url ?? `/api/v1/admin/products/${id}`, { method: "PATCH", body: { stock: n } }, { success: `Stock set to ${n}`, icon: "box" });
    if (ok === null) setVal(String(stock));
  }
  return (
    <input
      className={`am-stockin ${tone}`}
      type="number"
      inputMode="numeric"
      min={0}
      value={val}
      disabled={busy}
      aria-label="Stock"
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setVal(String(stock));
      }}
    />
  );
}
