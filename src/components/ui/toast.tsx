"use client";
/**
 * Toasts — call `toast("Saved to your wishlist", { icon: "heart" })` from any Client Component or event
 * handler. <Toaster /> is mounted once in the store layout (renders the demo's `#toast` pill).
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";

export type ToastOptions = {
  icon?: IconName;
  /** optional action link, e.g. { href: "/login", label: "Sign in" } */
  action?: { href: string; label: string };
  /** ms before it hides (default 2800, 4500 with an action) */
  duration?: number;
};

type ToastMsg = ToastOptions & { message: string; id: number };

const EVENT = "tbb:toast";
let seq = 0;

export function toast(message: string, opts: ToastOptions = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastMsg>(EVENT, { detail: { ...opts, message, id: ++seq } }));
}

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastMsg>).detail;
      setMsg(detail);
      setShow(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), detail.duration ?? (detail.action ? 4500 : 2800));
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div id="toast" role="status" aria-live="polite" className={show ? "show" : undefined}>
      {msg ? (
        <>
          <Icon name={msg.icon ?? "check"} />
          <span>{msg.message}</span>
          {msg.action ? (
            <Link className="toast-act" href={msg.action.href} onClick={() => setShow(false)} tabIndex={show ? 0 : -1}>
              {msg.action.label}
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
