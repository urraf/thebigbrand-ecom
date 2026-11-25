/**
 * Art direction for ad creatives — a port of the demo's themeOf()/vars()/headline()/hfStyle() (home.js).
 * Client-safe (used by Server Components and the booking preview).
 */
import type { CSSProperties } from "react";
import type { AdTheme, BrandLite } from "@/types/shared";
import { lum, shade } from "@/components/ui/cx";

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
export const isHex = (s: unknown): s is string => typeof s === "string" && HEX.test(s.trim());

/** Keep only characters that are safe inside a CSS value (gradients, colours). */
export function cssv(s: unknown): string {
  return String(s ?? "")
    .replace(/[^#a-z0-9(),.%\s-]/gi, "")
    .slice(0, 300);
}

function rgb(h: string): [number, number, number] {
  let x = h.replace("#", "");
  if (x.length < 6) x = x.slice(0, 3).split("").map((c) => c + c).join("");
  const n = parseInt(x.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rel(h: string): number {
  const c = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
  const x = rel(a);
  const y = rel(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export type ResolvedTheme = {
  bg: string;
  fg: string;
  ac: string;
  hi: string;
  cta: string;
  ctaFg: string;
  s0: string;
  s1: string;
  /** light text on a dark background */
  light: boolean;
};

/** Resolve a creative's theme into the colours the components need (contrast-checked). */
export function themeOf(theme: AdTheme | null | undefined, brand: Pick<BrandLite, "color" | "accent"> | null): ResolvedTheme {
  const t = theme ?? {};
  const col = brand && isHex(brand.color) ? brand.color : "#333333";
  const bg = cssv(t.bg) || `linear-gradient(120deg, ${shade(col, -0.35)}, ${col})`;
  const stops = bg.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || [col];
  const s0 = stops[0];
  const s1 = stops[1] || s0;
  const fg = isHex(t.fg) ? t.fg : lum(s0) > 0.6 ? "#151515" : "#ffffff";
  const light = lum(fg) > 0.6;
  const ac = isHex(t.accent) ? t.accent : light ? "#ffd36b" : col;
  const hi = Math.min(contrast(ac, s0), contrast(ac, s1)) >= 3.2 ? ac : fg;
  const cta = light ? (contrast(ac, s0) >= 3 ? ac : "#ffffff") : fg;
  const ctaFg = light ? (lum(s0) > 0.3 ? shade(s0, -0.45) : s0) : "#ffffff";
  return { bg, fg, ac, hi, cta, ctaFg, s0, s1, light };
}

function swash(c: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 16" preserveAspectRatio="none"><path d="M4 11C70 4.5 180 3 296 8.5" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** CSS custom properties for a themed creative (`--zn-bg`, `--zn-fg`, …). */
export function themeVars(th: ResolvedTheme, extra: Record<string, string> = {}): CSSProperties {
  return {
    "--zn-bg": th.bg,
    "--zn-fg": th.fg,
    "--zn-ac": th.ac,
    "--zn-hi": th.hi,
    "--zn-cta": th.cta,
    "--zn-ctafg": th.ctaFg,
    "--zn-s0": th.s0,
    "--zn-swash": swash(th.ac),
    ...extra,
  } as CSSProperties;
}

/** Split a headline so the closing phrase can get the hand-drawn swash underline. */
export function splitHeadline(text: string): [string, string] {
  const t = String(text || "").trim();
  const m = t.match(/^(.+?[.!?])\s+(\S.*)$/);
  if (m) return [m[1], m[2]];
  const w = t.split(/\s+/);
  const k = w.length > 3 ? 2 : w.length > 1 ? 1 : 0;
  return [w.slice(0, w.length - k).join(" "), w.slice(w.length - k).join(" ")];
}

/** Display typography per brand: [family, weight, tracking, size scale, italic] (demo HF map). */
const HF: Record<string, [string, number, string, number, boolean]> = {
  loreal: ["var(--font-dmserif), serif", 400, "-.015em", 1, false],
  lakme: ["var(--font-instrument), serif", 400, "-.02em", 1.14, true],
  minimalist: ["var(--font-geist), sans-serif", 300, "-.055em", 1, false],
  mamaearth: ["var(--font-bricolage), sans-serif", 800, "-.045em", 1, false],
  tbb: ["var(--font-bricolage), sans-serif", 800, "-.045em", 1, false],
  nivea: ["var(--font-bricolage), sans-serif", 800, "-.035em", 1, false],
  garnier: ["var(--font-bricolage), sans-serif", 800, "-.04em", 1, false],
  plum: ["var(--font-bricolage), sans-serif", 800, "-.05em", 1, false],
  parachute: ["var(--font-bricolage), sans-serif", 800, "-.04em", 1, false],
  beardo: ["var(--font-bebas), sans-serif", 400, ".01em", 1.28, false],
  bellavita: ["var(--font-syne), sans-serif", 700, "-.03em", 0.94, false],
  biotique: ["var(--font-instrument), serif", 400, "-.01em", 1.16, false],
  himalaya: ["var(--font-instrument), serif", 400, "-.01em", 1.16, true],
  dove: ["var(--font-instrument), serif", 400, "-.01em", 1.16, false],
  cetaphil: ["var(--font-geist), sans-serif", 600, "-.04em", 1, false],
  dermaco: ["var(--font-geist), sans-serif", 700, "-.04em", 1, false],
};

/** Headline font for a brand (known brands use the demo's art direction; others derive it from Brand.font). */
export function headStyle(brand: Pick<BrandLite, "slug" | "font"> | null): CSSProperties {
  let f = brand ? HF[brand.slug] : undefined;
  if (!f && brand?.font) {
    const fam = brand.font;
    if (/dmserif/.test(fam)) f = [fam, 400, "-.015em", 1, false];
    else if (/instrument/.test(fam)) f = [fam, 400, "-.01em", 1.14, false];
    else if (/bebas/.test(fam)) f = [fam, 400, ".01em", 1.28, false];
    else if (/syne/.test(fam)) f = [fam, 700, "-.03em", 0.94, false];
    else if (/geist/.test(fam)) f = [fam, 700, "-.04em", 1, false];
  }
  const [family, weight, tracking, scale, italic] = f ?? ["var(--font-bricolage), sans-serif", 800, "-.04em", 1, false];
  return { fontFamily: family, fontWeight: weight, letterSpacing: tracking, "--zn-fs": scale, fontStyle: italic ? "italic" : undefined } as CSSProperties;
}

/** Inline styles for the giant background wordmark. */
export function wordmarkStyle(brand: Pick<BrandLite, "font" | "fontWeight" | "textTransform" | "italic"> | null, text: string): CSSProperties {
  return {
    fontFamily: brand?.font ?? "inherit",
    fontWeight: brand?.fontWeight ?? 700,
    textTransform: (brand?.textTransform ?? "none") as CSSProperties["textTransform"],
    fontStyle: brand?.italic ? "italic" : undefined,
    "--zn-wmn": Math.max(4, text.length),
  } as CSSProperties;
}

/** Theme for a self-serve booking built from one brand colour (demo ads.fromCampaign). */
export function themeFromColor(color: string): AdTheme {
  const col = isHex(color) ? color : "#333333";
  return {
    bg: `linear-gradient(120deg, ${shade(col, -0.35)}, ${col} 60%, ${shade(col, 0.25)})`,
    fg: lum(col) > 0.6 ? "#151515" : "#ffffff",
    accent: "#ffd36b",
  };
}

/** Kicker text worth showing ("Sponsored" is redundant next to the label). */
export function kickerOf(k: string | null | undefined): string | null {
  const s = (k ?? "").trim();
  return s && !/^sponsored$/i.test(s) ? s : null;
}

/** Short product name for tight spaces ("Onion Hair Oil for Hair Growth" → "Onion Hair Oil"). */
export function shortName(name: string): string {
  return name.split(/,| for | with /i)[0].trim();
}
