/**
 * Mini page schematics showing where a placement sits (port of the demo's SX map + boxArt). Zero JS.
 */
import type { CSSProperties, ReactNode } from "react";

type Node =
  | { t: "r"; h: number; k: Node[]; on?: boolean }
  | { t: "c"; f: number; k: Node[]; on?: boolean }
  | { t: "b"; f: number; cls: string; on?: boolean };

const R = (h: number, ...k: Node[]): Node => ({ t: "r", h, k });
const RO = (h: number, ...k: Node[]): Node => ({ t: "r", h, k, on: true });
const C = (f: number, ...k: Node[]): Node => ({ t: "c", f, k });
const CO = (f: number, ...k: Node[]): Node => ({ t: "c", f, k, on: true });
const b = (f = 1, cls = ""): Node => ({ t: "b", f, cls });
const o = (f = 1, cls = ""): Node => ({ t: "b", f, cls, on: true });
const ps = (n: number) => Array.from({ length: n }, () => b(1, "p"));

const SX: Record<string, Node[]> = {
  H1: [RO(52, o(1, "hero")), R(24, ...ps(4)), R(0, b(), b())],
  H2: [R(46, b(1, "hero")), R(36, o(1, "card"), o(1, "card"), o(1, "card"), o(1, "card")), R(0, b())],
  H3: [R(36, b(1, "hero")), RO(16, o()), R(0, ...ps(4))],
  H4: [R(30, b(1, "hero")), R(6, b(0.4, "t"), b(1.6, "x")), R(0, o(1, "tile"), b(1, "tile"), b(1, "tile"), b(1, "tile"), b(1, "tile"))],
  H5: [R(24, b(1, "hero")), R(0, o(2, "video"), C(1, b(), b(), b()))],
  H6: [R(22, b(1, "hero")), R(0, o(1, "reel"), o(1, "reel"), o(1, "reel"), o(1, "reel"), b(1, "reel"))],
  H7: [R(26, b(1, "hero")), R(0, b(1, "logo"), o(1, "logo"), b(1, "logo"), b(1, "logo"), o(1, "logo"), b(1, "logo")), R(0, b(1, "logo"), b(1, "logo"), o(1, "logo"), b(1, "logo"), b(1, "logo"), b(1, "logo"))],
  H8: [R(24, b(1, "hero")), R(0, o(1, "ban"), o(1, "ban")), R(22, ...ps(4))],
  H9: [R(26, b(1, "hero")), R(0, o(1, "cp"), o(1, "cp"), o(1, "cp"), o(1, "cp")), R(0, o(1, "cp"), o(1, "cp"), o(1, "cp"), o(1, "cp"))],
  H10: [R(22, b(1, "hero")), RO(0, o(1.1, "p"), o(2.2, "deal"), o(0.9, "timer")), R(22, ...ps(4))],
  H11: [R(22, b(1, "hero")), RO(0, o(1.3, "shelf"), o(1, "p"), o(1, "p"), o(1, "p"), o(1, "p"))],
  S1: [R(0, b(0.5, "x"), CO(2, o(1, "t")), b(0.5, "x")), R(0, C(0.8, b(1, "f")), C(3, R(0, ...ps(4))))],
  S2: [R(0, C(0.8, b(1, "f")), C(3, RO(26, o(1, "ban")), R(0, ...ps(4))))],
  S3: [R(0, C(0.8, b(1, "f")), C(3, R(0, o(1, "p"), o(1, "p"), b(1, "p"), b(1, "p")), R(0, ...ps(4))))],
  S4: [R(0, C(0.8, b(1, "f")), C(3, R(0, b(1, "p"), b(1, "p"), o(1, "native"), b(1, "p")), R(0, ...ps(4))))],
  P1: [R(0, b(1.1, "img"), C(1.4, b(0.5, "t"), b(1, "t"), b(1, "t")), C(0.9, b(1, "buy"))), RO(36, o(1, "p"), o(1, "p"), o(1, "p"), o(1, "p"), o(1, "p"))],
  P2: [R(0, b(1.1, "img"), C(1.4, b(0.5, "t"), b(1, "t"), b(1, "t"), b(1, "t")), C(0.9, b(1, "buy"), o(1.1, "ban"))), R(26, ...ps(5))],
  C1: [R(0, C(2, b(1, "line"), b(1, "line"), RO(0, o(1, "p"), o(1, "p"), o(1, "p"))), C(1, b(1, "buy")))],
  C2: [R(28, b(1, "okb")), RO(0, o(1, "ban")), R(22, b(), b())],
  B1: [CO(1, R(40, o(1, "bhero")), R(0, o(1, "p"), o(1, "p"), o(1, "p"), o(1, "p")))],
};

function render(n: Node, key: number): ReactNode {
  if (n.t === "r") {
    const style: CSSProperties = n.h ? { height: n.h, flex: "none" } : { flex: 1 };
    return (
      <div key={key} className={n.on ? "av-sx-r on" : "av-sx-r"} style={style}>
        {n.k.map(render)}
      </div>
    );
  }
  if (n.t === "c") {
    return (
      <div key={key} className={n.on ? "av-sx-c on" : "av-sx-c"} style={{ flex: n.f }}>
        {n.k.map(render)}
      </div>
    );
  }
  return <i key={key} className={`av-sx-b ${n.cls}${n.on ? " on" : ""}`} style={{ flex: n.f }} />;
}

export function BoxArt({ className = "" }: { className?: string }) {
  return (
    <svg className={`av-boxart ${className}`} viewBox="0 0 280 220" aria-hidden="true">
      <defs>
        <linearGradient id={`avBoxG${className ? "-lg" : ""}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3d6e" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
      </defs>
      <ellipse cx="140" cy="202" rx="112" ry="10" fill="rgba(90,40,20,.16)" />
      <path d="M40 92 L140 64 L126 20 L28 48 Z" fill="#e7b880" />
      <path d="M140 64 L240 92 L256 50 L154 22 Z" fill="#d9a468" />
      <path d="M40 92 L140 64 L240 92 L140 120 Z" fill="#8c5a32" />
      <g transform="rotate(-10 96 64)">
        <rect x="64" y="14" width="64" height="88" rx="6" fill="#fff" />
        <rect x="64" y="14" width="64" height="88" rx="6" fill="none" stroke="#ff3d6e" strokeWidth="2.2" strokeDasharray="6 4" />
        <rect x="71" y="21" width="50" height="24" rx="4" fill={`url(#avBoxG${className ? "-lg" : ""})`} />
        <text x="96" y="37" textAnchor="middle" fill="#fff" style={{ font: "800 10px var(--font-bricolage), sans-serif", letterSpacing: ".06em" }}>
          YOUR
        </text>
        <rect x="71" y="51" width="44" height="5" rx="2.5" fill="#e4dfee" />
        <rect x="71" y="61" width="34" height="5" rx="2.5" fill="#e4dfee" />
        <rect x="71" y="74" width="22" height="20" rx="3" fill="#f2eff8" />
        <rect x="74" y="77" width="16" height="14" fill="#140a24" opacity=".7" />
      </g>
      <g transform="rotate(5 140 74)">
        <rect x="124" y="44" width="34" height="50" rx="5" fill="#1f9e96" />
        <rect x="124" y="44" width="34" height="9" rx="4" fill="#fff" opacity=".35" />
        <text x="141" y="73" textAnchor="middle" fill="#fff" style={{ font: "700 7px var(--font-geist), sans-serif" }}>
          SAMPLE
        </text>
      </g>
      <g transform="rotate(14 182 64)">
        <rect x="168" y="18" width="20" height="12" rx="2" fill="#ffe1e8" />
        <path d="M164 28 H192 L188 104 Q178 108 168 104 Z" fill="#ff4d6d" />
        <text x="178" y="64" textAnchor="middle" fill="#fff" style={{ font: "800 8px var(--font-bricolage), sans-serif" }}>
          TBB
        </text>
      </g>
      <path d="M40 92 L140 120 L140 196 L40 166 Z" fill="#dda76c" />
      <path d="M140 120 L240 92 L240 166 L140 196 Z" fill="#c68d52" />
      <path d="M40 92 L140 120 L140 131 L40 103 Z" fill="#fff" opacity=".16" />
      <path d="M140 120 L240 92 L240 103 L140 131 Z" fill="#fff" opacity=".1" />
      <path d="M164 140 L222 124 L222 150 L164 166 Z" fill="#fff" opacity=".95" />
      <path d="M170 144 L182 141 L182 153 L170 156 Z" fill={`url(#avBoxG${className ? "-lg" : ""})`} />
      <path d="M186 145 L214 137 L214 141 L186 149 Z" fill="#cfc8db" />
      <path d="M186 152 L206 146 L206 150 L186 156 Z" fill="#e2dcea" />
    </svg>
  );
}

export function Schematic({ code }: { code: string }) {
  if (code === "X1") {
    return (
      <div className="av-sx av-sx-box">
        <BoxArt />
      </div>
    );
  }
  const spec = SX[code] ?? [R(0, o())];
  return (
    <div className="av-sx" aria-hidden="true">
      <div className={code === "S1" ? "av-sx-hd s1" : "av-sx-hd"}>
        <i />
        <b />
        <u />
      </div>
      <div className="av-sx-nv" />
      <div className="av-sx-bd">{spec.map(render)}</div>
    </div>
  );
}
