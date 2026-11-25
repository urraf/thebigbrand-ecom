"use client";
import { useEffect, useRef } from "react";

/**
 * <ChromeOff /> that switches itself off when its page is hidden. With Cache Components, Next keeps visited
 * pages mounted inside a hidden <Activity>, so a plain `[data-chrome-off]` marker would keep hiding the store
 * header after the shopper navigates away from checkout. Effects are torn down while hidden, so the marker
 * attribute is removed then and restored when the page shows again (it is in the server HTML for a
 * flash-free first paint).
 */
export function ChromeOffLive() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.setAttribute("data-chrome-off", "");
    return () => el?.removeAttribute("data-chrome-off");
  }, []);
  return <span ref={ref} data-chrome-off="" hidden />;
}
