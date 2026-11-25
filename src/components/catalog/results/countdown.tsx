"use client";
import { Fragment, useEffect, useState } from "react";

const IST = 330 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
/** Seconds until the next midnight in India — today's deals end at 00:00 IST. */
function untilMidnightIST(now = Date.now()): number {
  const ist = now + IST;
  const next = Math.floor(ist / 864e5) * 864e5 + 864e5;
  return Math.max(0, Math.min(86399, Math.floor((next - ist) / 1000)));
}

/** "Deals end in hh:mm:ss" (placeholders until mounted — the static shell can't know the time). */
export function DealsCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(untilMidnightIST());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  const units: [string, string][] =
    left == null
      ? [["--", "hrs"], ["--", "min"], ["--", "sec"]]
      : [[pad(Math.floor(left / 3600)), "hrs"], [pad(Math.floor((left % 3600) / 60)), "min"], [pad(left % 60), "sec"]];
  return (
    <div className="sr-cd" aria-hidden="true">
      {units.map(([v, l], i) => (
        <Fragment key={l}>
          {i ? <em>:</em> : null}
          <span>
            <b>{v}</b>
            <i>{l}</i>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
