import type { ReactNode } from "react";
import type { BrandLite, PackshotArt } from "@/types/shared";
import { cx, lum, safeColor, shade } from "./cx";

export type PackshotProps = {
  art: PackshotArt;
  name: string;
  brand: Pick<BrandLite, "name" | "word" | "isOwn">;
  /** TBB Originals print "TBB" on the label */
  isOwnLabel?: boolean;
  className?: string;
  /** set false when a parent already labels the image */
  labelled?: boolean;
};

type Box = { x: number; y: number; w: number; h: number };

/**
 * SVG product packshot — a faithful port of the demo's art(): bottle | tube | dropper | jar | pump | stick,
 * coloured from Product.colorPrimary/colorSecondary with a printed brand label. Used whenever a product has
 * no photo (the client's own TBB label until their photography arrives). Shared, zero-JS component.
 */
export function Packshot({ art, name, brand, isOwnLabel, className, labelled = true }: PackshotProps) {
  const c1 = safeColor(art.c1, "#e8e4ee");
  const c2 = safeColor(art.c2, "#5b35e0");
  const darkBody = lum(c1) < 0.55;
  const lbl = darkBody ? "rgba(255,255,255,.93)" : c2;
  const ink = darkBody ? shade(c1, -0.25) : lum(c2) < 0.6 ? "#ffffff" : "#222222";
  const brandTxt = isOwnLabel || brand.isOwn ? "TBB" : (brand.word || brand.name).replace(" PARIS", "").toUpperCase();
  const line = (art.line || name.split(" ").slice(0, 2).join(" ")).toUpperCase();
  const edge = { stroke: "rgba(0,0,0,.07)", strokeWidth: 1 };

  let body: ReactNode;
  let L: Box;
  let shadow = 44;
  switch (art.shape) {
    case "tube":
      body = (
        <>
          <rect x="58" y="20" width="84" height="14" rx="2" fill={shade(c1, -0.14)} />
          <path d="M60 32H140L126 182Q100 188 74 182Z" fill={c1} {...edge} />
          <rect x="76" y="178" width="48" height="44" rx="8" fill={c2} />
          <path d="M70 40 L80 40 L80 170 L76 170Z" fill="#fff" opacity=".22" />
        </>
      );
      L = { x: 72, y: 70, w: 56, h: 70 };
      shadow = 34;
      break;
    case "dropper":
      body = (
        <>
          <rect x="89" y="14" width="22" height="42" rx="11" fill={shade(c2, -0.1)} />
          <rect x="80" y="50" width="40" height="26" rx="5" fill={c2} />
          <rect x="62" y="74" width="76" height="148" rx="14" fill={c1} {...edge} />
          <rect x="70" y="84" width="8" height="128" rx="4" fill="#fff" opacity=".25" />
        </>
      );
      L = { x: 72, y: 118, w: 56, h: 68 };
      shadow = 40;
      break;
    case "jar":
      body = (
        <>
          <rect x="44" y="104" width="112" height="34" rx="8" fill={c2} />
          <rect x="44" y="104" width="112" height="8" rx="4" fill="#fff" opacity=".18" />
          <rect x="50" y="134" width="100" height="88" rx="16" fill={c1} {...edge} />
          <rect x="58" y="142" width="8" height="70" rx="4" fill="#fff" opacity=".22" />
        </>
      );
      L = { x: 68, y: 150, w: 72, h: 54 };
      shadow = 56;
      break;
    case "pump":
      body = (
        <>
          <rect x="64" y="16" width="44" height="10" rx="5" fill={c2} />
          <rect x="94" y="16" width="12" height="26" rx="3" fill={c2} />
          <rect x="82" y="38" width="36" height="22" rx="5" fill={shade(c2, -0.12)} />
          <rect x="58" y="58" width="84" height="164" rx="22" fill={c1} {...edge} />
          <rect x="67" y="70" width="9" height="140" rx="4.5" fill="#fff" opacity=".24" />
        </>
      );
      L = { x: 72, y: 110, w: 62, h: 76 };
      break;
    case "stick":
      body = (
        <>
          <path d="M86 46Q86 30 114 22V98H86Z" fill={c1} />
          <rect x="82" y="94" width="36" height="30" rx="3" fill="#d4af37" />
          <rect x="82" y="94" width="36" height="6" fill="#fff" opacity=".3" />
          <rect x="74" y="120" width="52" height="102" rx="8" fill={c2} />
          <rect x="80" y="128" width="6" height="86" rx="3" fill="#fff" opacity=".18" />
        </>
      );
      L = { x: 84, y: 150, w: 36, h: 46 };
      shadow = 32;
      break;
    default: // bottle
      body = (
        <>
          <rect x="80" y="26" width="40" height="28" rx="6" fill={c2} />
          <rect x="76" y="48" width="48" height="10" rx="3" fill={shade(c2, -0.15)} />
          <rect x="56" y="56" width="88" height="166" rx="26" fill={c1} {...edge} />
          <rect x="66" y="68" width="9" height="146" rx="4.5" fill="#fff" opacity=".22" />
        </>
      );
      L = { x: 74, y: 112, w: 62, h: 74 };
  }

  const fs1 = Math.max(5.5, Math.min(14, L.w / (brandTxt.length * 0.66)));
  const fs2 = Math.max(4.6, Math.min(8.5, L.w / (line.length * 0.66)));
  const cxm = L.x + L.w / 2;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <svg
      className={cx("art", className)}
      viewBox="0 0 200 240"
      {...(labelled ? { role: "img", "aria-label": `${brand.name} ${name}` } : { "aria-hidden": true })}
    >
      <ellipse cx="100" cy="226" rx={shadow} ry="5" fill="rgba(0,0,0,.14)" />
      {body}
      <rect x={L.x} y={L.y} width={L.w} height={L.h} rx="5" fill={lbl} />
      <text
        x={cxm}
        y={r1(L.y + L.h * 0.44)}
        textAnchor="middle"
        fill={ink}
        style={{ font: `700 ${fs1.toFixed(1)}px var(--font-geist), sans-serif`, letterSpacing: ".04em" }}
      >
        {brandTxt}
      </text>
      <rect x={cxm - 8} y={r1(L.y + L.h * 0.54)} width="16" height="1.2" fill={ink} opacity=".5" />
      <text
        x={cxm}
        y={r1(L.y + L.h * 0.75)}
        textAnchor="middle"
        fill={ink}
        opacity=".85"
        style={{ font: `600 ${fs2.toFixed(1)}px var(--font-geist), sans-serif`, letterSpacing: ".06em" }}
      >
        {line}
      </text>
    </svg>
  );
}
