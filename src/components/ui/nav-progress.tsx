"use client";
/**
 * Slim top progress bar for page navigations (store, seller portal, admin console). Starts when an internal link
 * is clicked or a GET form (e.g. search) is submitted, and finishes when the URL changes. No timers in render,
 * no external library. Wrap in <Suspense fallback={null}> (it reads search params).
 */
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress({ tone = "coral" }: { tone?: "coral" | "violet" }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `${pathname}?${search}`;
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | undefined;
    const here = () => `${location.pathname}?${location.search.replace(/^\?/, "")}`;
    const start = (url: URL) => {
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setFrom(here());
      clearTimeout(safety);
      safety = setTimeout(() => setFrom(null), 10000);
    };
    // Capture phase: Next's <Link> calls preventDefault() in React's handler (it navigates client-side), so a
    // bubble-phase listener would always see defaultPrevented. Capturing first sees the original click.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (a.getAttribute("href")?.startsWith("#")) return;
      start(new URL(a.href, location.href));
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if ((f.method || "get").toLowerCase() !== "get" || !f.action) return;
      start(new URL(f.action, location.href));
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clearTimeout(safety);
    };
  }, []);

  const state = from === null ? "idle" : from === key ? "loading" : "done";
  return <div className={`navp navp-${tone}`} data-state={state} aria-hidden="true" key={state === "loading" ? `l-${from}` : undefined} />;
}
