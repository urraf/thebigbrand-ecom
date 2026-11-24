/** Money helpers. All amounts are integer rupees unless stated. Client-safe. */

export function formatINR(rupees: number, opts: { decimals?: boolean } = {}): string {
  const n = Number(rupees) || 0;
  if (opts.decimals) {
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** 125000 → "1.3L", 12500 → "12.5K" */
export function compactINR(rupees: number): string {
  const n = Math.round(Number(rupees) || 0);
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return "₹" + n;
}

export function discountPct(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const fromPaise = (paise: number) => Math.round(paise) / 100;

export function compactNumber(n: number): string {
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}
