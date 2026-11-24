/** Tiny className joiner + colour helpers shared by the UI kit (client-safe, no deps). */

export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(" ");
}

export function hexRgb(hex: string): [number, number, number] {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [200, 196, 210];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lighten (a > 0) or darken (a < 0) a hex colour by a fraction. Port of the demo's shade(). */
export function shade(hex: string, a: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a)));
  return "#" + hexRgb(hex).map(f).map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Perceived luminance 0..1. Port of the demo's lum(). */
export function lum(hex: string): number {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function safeColor(c: string | null | undefined, fallback: string): string {
  return c && HEX.test(c.trim()) ? c.trim() : fallback;
}
