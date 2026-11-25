import "@/styles/lost.css";

/**
 * Animated "404" illustration shared by every not-found page (store, seller portal, admin console, root):
 * the 0 is a spinning compact mirror with a shine sweep, flanked by floating 4s, a bobbing lipstick, a bouncing
 * gift box and twinkling sparkles. Pure CSS/SVG (no JS); motion stops under prefers-reduced-motion.
 */
export function LostArt({ code = "404", compact = false }: { code?: string; compact?: boolean }) {
  const [a, , c] = code.split("");
  return (
    <div className={compact ? "lost lost-sm" : "lost"} role="img" aria-label={`Error ${code}`}>
      <span className="lost-spark s1" />
      <span className="lost-spark s2" />
      <span className="lost-spark s3" />
      <span className="lost-spark s4" />
      <div className="lost-row" aria-hidden="true">
        <span className="lost-d lost-d1">{a}</span>
        <span className="lost-zero">
          <svg viewBox="0 0 120 120">
            <defs>
              <linearGradient id="lostRim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff3d6e" />
                <stop offset="1" stopColor="#ff9a3d" />
              </linearGradient>
              <radialGradient id="lostGlass" cx=".35" cy=".3" r=".9">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset=".55" stopColor="#efeaff" />
                <stop offset="1" stopColor="#d9cffb" />
              </radialGradient>
              <clipPath id="lostClip">
                <circle cx="60" cy="60" r="40" />
              </clipPath>
            </defs>
            <circle cx="60" cy="60" r="54" fill="url(#lostRim)" />
            <circle cx="60" cy="60" r="46" fill="#140a24" opacity=".18" />
            <circle cx="60" cy="60" r="40" fill="url(#lostGlass)" />
            <g clipPath="url(#lostClip)">
              <rect className="lost-shine" x="-40" y="-10" width="22" height="140" fill="#fff" opacity=".75" transform="rotate(25 60 60)" />
            </g>
            <text x="60" y="68" textAnchor="middle" className="lost-tbb">
              tbb
            </text>
          </svg>
        </span>
        <span className="lost-d lost-d2">{c}</span>
      </div>
      <div className="lost-props" aria-hidden="true">
        <span className="lost-lip">
          <i className="lip-bullet" />
          <i className="lip-case" />
        </span>
        <span className="lost-shadow sh1" />
        <span className="lost-gift">
          <i className="gift-lid" />
          <i className="gift-box" />
        </span>
        <span className="lost-shadow sh2" />
      </div>
    </div>
  );
}
