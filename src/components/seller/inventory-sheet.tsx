"use client";
/**
 * Bulk stock & price sheet. Edits are local until "Save changes" → PATCH /api/v1/seller/inventory.
 * Price must stay ≤ MRP; operational edits never send a live product back to review.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { discountPct, formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, errorText } from "./api";
import { Thumb } from "./thumb";
import { PRODUCT_STATUS_LABEL, STATUS_TONE } from "./format";

export type InvRow = {
  id: string;
  name: string;
  brand: string;
  size: string | null;
  sku: string | null;
  status: string;
  mrp: number;
  price: number;
  stock: number;
  unitsSold: number;
  image: { url: string; alt: string | null } | null;
  art: { shape: string | null; c1: string | null; c2: string | null };
};

type Draft = { stock: string; price: string };

export function InventorySheet({ rows }: { rows: InvRow[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"set" | "add">("add");
  const [bulkQty, setBulkQty] = useState("");
  const [saving, setSaving] = useState(false);

  const val = (r: InvRow): Draft => draft[r.id] ?? { stock: String(r.stock), price: String(r.price) };
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const r of rows) {
      const d = draft[r.id];
      if (!d) continue;
      const p = Number(d.price);
      const s = Number(d.stock);
      if (d.stock === "" || !Number.isInteger(s) || s < 0 || s > 100000) e[r.id] = "Stock must be 0–1,00,000";
      else if (d.price === "" || !Number.isInteger(p) || p < 1) e[r.id] = "Enter a price";
      else if (p > r.mrp) e[r.id] = `Price can't exceed MRP ${formatINR(r.mrp)}`;
    }
    return e;
  }, [draft, rows]);

  const changes = rows
    .map((r) => {
      const d = draft[r.id];
      if (!d) return null;
      const out: { id: string; stock?: number; price?: number } = { id: r.id };
      if (Number(d.stock) !== r.stock) out.stock = Number(d.stock);
      if (Number(d.price) !== r.price) out.price = Number(d.price);
      return out.stock !== undefined || out.price !== undefined ? out : null;
    })
    .filter(Boolean) as { id: string; stock?: number; price?: number }[];

  function set(r: InvRow, patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, [r.id]: { ...val(r), ...patch } }));
  }

  function applyBulk() {
    const n = parseInt(bulkQty, 10);
    if (!sel.size) return toast("Select products first", { icon: "info" });
    if (!Number.isFinite(n) || n < 0) return toast("Enter a quantity", { icon: "info" });
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!sel.has(r.id)) continue;
        const cur = next[r.id] ?? { stock: String(r.stock), price: String(r.price) };
        const s = bulkMode === "set" ? n : (Number(cur.stock) || 0) + n;
        next[r.id] = { ...cur, stock: String(Math.min(100000, s)) };
      }
      return next;
    });
    toast(`${bulkMode === "set" ? "Stock set" : "Stock added"} for ${sel.size} ${sel.size === 1 ? "product" : "products"} — review and save`, { icon: "layers" });
  }

  async function save() {
    if (Object.keys(errors).length) return toast(Object.values(errors)[0], { icon: "info" });
    if (!changes.length) return;
    setSaving(true);
    try {
      const out = await api<{ updated: number }>("/api/v1/seller/inventory", { method: "PATCH", body: { items: changes } });
      toast(`Saved ${out.updated} ${out.updated === 1 ? "product" : "products"} — live now`, { icon: "check" });
      setDraft({});
      setSel(new Set());
      start(() => router.refresh());
    } catch (e) {
      toast(errorText(e), { icon: "info" });
    } finally {
      setSaving(false);
    }
  }

  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <>
      <div className="sl-filters" style={{ marginBottom: 12 }}>
        <span className="sl-muted" style={{ fontSize: 13 }}>{sel.size ? `${sel.size} selected` : "Select rows to change stock in bulk"}</span>
        <select className="sl-select" value={bulkMode} onChange={(e) => setBulkMode(e.target.value as "set" | "add")} aria-label="Bulk action">
          <option value="add">Add stock</option>
          <option value="set">Set stock to</option>
        </select>
        <input className="sl-select" style={{ width: 110 }} inputMode="numeric" value={bulkQty} onChange={(e) => setBulkQty(e.target.value.replace(/\D/g, ""))} placeholder="Qty" aria-label="Quantity" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={applyBulk} disabled={!sel.size}>
          Apply to selected
        </button>
      </div>
      <div className="sl-tscroll sl-tstack">
        <table className="sl-table sl-inv sl-stack sl-stack-inv">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSel}
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  style={{ width: 16, height: 16 }}
                />
              </th>
              <th>Product</th>
              <th>Status</th>
              <th className="r">MRP</th>
              <th>Selling price</th>
              <th>Stock</th>
              <th className="r">Sold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = val(r);
              const dirty = !!draft[r.id] && (Number(v.stock) !== r.stock || Number(v.price) !== r.price);
              const e = errors[r.id];
              const off = discountPct(r.mrp, Number(v.price) || 0);
              return (
                <tr key={r.id} className={dirty ? "is-dirty" : undefined}>
                  <td className="sl-x-chk">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={sel.has(r.id)}
                      onChange={(ev) =>
                        setSel((prev) => {
                          const n = new Set(prev);
                          if (ev.target.checked) n.add(r.id);
                          else n.delete(r.id);
                          return n;
                        })
                      }
                      style={{ width: 16, height: 16 }}
                    />
                  </td>
                  <td className="sl-x-prod">
                    <div className="sl-prod">
                      <Thumb name={r.name} brand={r.brand} image={r.image} art={r.art} size="sm" />
                      <span>
                        <b>{r.name}</b>
                        <small>
                          {r.brand}
                          {r.size ? ` · ${r.size}` : ""}
                          {r.sku ? ` · ${r.sku}` : ""}
                        </small>
                        {e ? <small className="sl-err" style={{ color: "var(--sale)", fontWeight: 600 }}>{e}</small> : null}
                      </span>
                    </div>
                  </td>
                  <td data-l="Status">
                    <span className={`sl-pill sl-pill-${STATUS_TONE[r.status] ?? "off"}`}>
                      <i aria-hidden="true" />
                      {PRODUCT_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="r num" data-l="MRP">
                    {formatINR(r.mrp)}
                  </td>
                  <td data-l="Selling price">
                    <span className="sl-rs" style={{ display: "inline-block" }}>
                      <i>₹</i>
                      <input
                        inputMode="numeric"
                        value={v.price}
                        aria-label={`Price for ${r.name}`}
                        aria-invalid={!!e && e.includes("rice")}
                        onChange={(ev) => set(r, { price: ev.target.value.replace(/\D/g, "") })}
                      />
                    </span>
                    <span className="sl-sub">{off ? `${off}% off` : "No discount"}</span>
                  </td>
                  <td data-l="Stock">
                    <span className="sl-step">
                      <button type="button" aria-label={`Decrease stock for ${r.name}`} onClick={() => set(r, { stock: String(Math.max(0, (Number(v.stock) || 0) - 1)) })}>
                        <Icon name="minus" />
                      </button>
                      <input
                        inputMode="numeric"
                        value={v.stock}
                        aria-label={`Stock for ${r.name}`}
                        aria-invalid={!!e && e.includes("Stock")}
                        onChange={(ev) => set(r, { stock: ev.target.value.replace(/\D/g, "") })}
                        style={{ width: 80, textAlign: "center" }}
                      />
                      <button type="button" aria-label={`Increase stock for ${r.name}`} onClick={() => set(r, { stock: String(Math.min(100000, (Number(v.stock) || 0) + 1)) })}>
                        <Icon name="plus" />
                      </button>
                    </span>
                    {Number(v.stock) <= 10 ? <span className="sl-sub sl-warn-t">{Number(v.stock) === 0 ? "Sold out" : "Low stock"}</span> : null}
                  </td>
                  <td className="r num" data-l="Sold">
                    {r.unitsSold}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={changes.length ? "sl-sticky-act" : "sl-sticky-act is-idle"} style={{ marginTop: 16 }}>
        <small>{changes.length ? `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"}` : "No changes yet"}</small>
        <span className="sl-spacer" />
        <button type="button" className="btn btn-ghost" disabled={!changes.length || saving} onClick={() => setDraft({})}>
          Discard
        </button>
        <button type="button" className="btn btn-cart" disabled={!changes.length || saving} onClick={save}>
          <Icon name="check" /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
