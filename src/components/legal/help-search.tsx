"use client";
/** Filters the server-rendered FAQ list in place (no data fetch): hides questions that don't match, opens those that do. */
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function HelpSearch({ target }: { target: string }) {
  const [q, setQ] = useState("");
  const [none, setNone] = useState(false);

  function filter(value: string) {
    setQ(value);
    const root = document.getElementById(target);
    if (!root) return;
    const needle = value.trim().toLowerCase();
    root.classList.toggle("is-filtering", needle.length > 0);
    let shown = 0;
    root.querySelectorAll<HTMLDetailsElement>(".hc-q").forEach((d) => {
      const hit = !needle || (d.textContent ?? "").toLowerCase().includes(needle);
      d.hidden = !hit;
      if (hit) shown++;
      d.open = Boolean(needle && hit);
    });
    setNone(needle.length > 0 && shown === 0);
  }

  return (
    <>
      <div className="hc-search" role="search">
        <Icon name="search" />
        <input type="search" value={q} onChange={(e) => filter(e.target.value)} placeholder="Search help — e.g. refund, free gift, COD" aria-label="Search help articles" />
      </div>
      {none ? (
        <p className="hc-none" role="status">
          No answers match &ldquo;{q}&rdquo;. Try another word, or <Link href="/contact">send us a message</Link>.
        </p>
      ) : null}
    </>
  );
}
