"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Owner · full access", STAFF: "Staff" };

/** Avatar button + menu (account, view store, log out). */
export function UserMenu({ name, email, role }: { name: string; email: string | null; role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ini = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", headers: { "x-tbb-scope": "admin" } });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="am-me-w" ref={ref}>
      <button type="button" className="am-me" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="am-av" aria-hidden="true">
          {ini || "A"}
        </span>
        <span className="am-me-t">
          <b>{name}</b>
          <small>{role === "ADMIN" ? "Owner" : "Staff"}</small>
        </span>
        <Icon name="chevDown" />
      </button>
      {open ? (
        <div className="am-menu" role="menu">
          <div className="am-menu-h">
            <b>{name}</b>
            <small>{email}</small>
            <small>{ROLE_LABEL[role] ?? role}</small>
          </div>
          <Link href="/" role="menuitem" target="_blank" onClick={() => setOpen(false)}>
            <Icon name="store" />
            View store
          </Link>
          {role === "ADMIN" ? (
            <Link href="/admin/settings" role="menuitem" onClick={() => setOpen(false)}>
              <Icon name="sliders" />
              Store settings
            </Link>
          ) : null}
          <button type="button" role="menuitem" className="am-menu-out" onClick={logout} disabled={busy} aria-busy={busy || undefined}>
            <Icon name="logout" />
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
