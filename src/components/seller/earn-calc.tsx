"use client";
/** /sell earnings calculator: selling price → commission → what the seller receives (12% default). */
import { useState } from "react";
import { formatINR } from "@/lib/money";

export function EarnCalc({ commissionPct = 12 }: { commissionPct?: number }) {
  const [price, setPrice] = useState(499);
  const [units, setUnits] = useState(200);
  const commission = Math.round((price * commissionPct) / 100);
  const per = price - commission;
  return (
    <div className="sell-calc">
      <div>
        <h3>What you earn</h3>
        <p>Move the numbers — no hidden fees, no fixed closing charges.</p>
      </div>
      <label>
        Selling price per unit
        <span className="sell-calc-in">
          <i>₹</i>
          <input inputMode="numeric" value={price || ""} onChange={(e) => setPrice(Math.min(100000, Number(e.target.value.replace(/\D/g, "")) || 0))} aria-label="Selling price in rupees" />
        </span>
      </label>
      <label>
        Units sold a month: {units.toLocaleString("en-IN")}
        <input type="range" min={10} max={2000} step={10} value={units} onChange={(e) => setUnits(Number(e.target.value))} aria-label="Units sold per month" />
      </label>
      <dl>
        <div>
          <dt>Commission ({commissionPct}%)</dt>
          <dd>−{formatINR(commission)} / unit</dd>
        </div>
        <div>
          <dt>You receive</dt>
          <dd>{formatINR(per)} / unit</dd>
        </div>
        <div className="tot">
          <dt>Monthly payout</dt>
          <dd>{formatINR(per * units)}</dd>
        </div>
      </dl>
    </div>
  );
}
