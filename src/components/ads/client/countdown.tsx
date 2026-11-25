"use client";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

const IST = 330 * 60 * 1000;
/** Seconds until the next midnight in India (deal of the day ends at 00:00 IST). */
function untilMidnightIST(now = Date.now()): number {
  const ist = now + IST;
  const next = Math.floor(ist / 864e5) * 864e5 + 864e5;
  return Math.max(0, Math.min(86399, Math.floor((next - ist) / 1000)));
}
const pad = (n: number) => String(n).padStart(2, "0");

/** H10 "Ends in hh:mm:ss" countdown to midnight IST (renders placeholders until mounted). */
export function Countdown({ label = "Ends in" }: { label?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(untilMidnightIST());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  const units: [string, string][] = left == null
    ? [["--", "hrs"], ["--", "min"], ["--", "sec"]]
    : [[pad(Math.floor(left / 3600)), "hrs"], [pad(Math.floor((left % 3600) / 60)), "min"], [pad(left % 60), "sec"]];
  return (
    <div className="zn-cd" role="timer" aria-label="Deal ends at midnight">
      <span className="zn-cd-l">
        <Icon name="clock" />
        {label}
      </span>
      {units.map(([v, l], k) => (
        <Fragment key={l}>
          {k ? <i aria-hidden="true">:</i> : null}
          <span className="zn-cd-u">
            <b>{v}</b>
            <small>{l}</small>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
