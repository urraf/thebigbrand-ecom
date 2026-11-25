"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

type Hit = { type: "order" | "product" | "customer" | "brand" | "seller"; id: string; title: string; sub: string; href: string };
const GROUP: Record<Hit["type"], { label: string; icon: IconName }> = {
  order: { label: "Orders", icon: "box" },
  product: { label: "Products", icon: "bag" },
  customer: { label: "Customers", icon: "user" },
  brand: { label: "Brands", icon: "tag" },
  seller: { label: "Sellers", icon: "store" },
};

/** Top-bar search (orders by number/name/phone, products, customers, brands, sellers) → GET /api/v1/admin/dashboard/search */
export function AdminSearch() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/admin/dashboard/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const json = await res.json();
        if (id === seq.current) {
          setHits(json.data?.items ?? []);
          setActive(-1);
        }
      } catch {
        if (id === seq.current) setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        box.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!hits?.length || q.trim().length < 2) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const term = q.trim();
  const shown = term.length >= 2 ? hits : null;
  let lastType = "";
  return (
    <form
      className="am-search"
      role="search"
      ref={box}
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (shown && active >= 0 && shown[active]) return go(shown[active].href);
        if (shown && shown.length === 1) return go(shown[0].href);
        if (!term) return;
        // order numbers jump to orders, everything else to the product list
        go(/^tbb\d{4,}/i.test(term) || /^\d{10}$/.test(term) ? `/admin/orders?q=${encodeURIComponent(term)}` : `/admin/products?q=${encodeURIComponent(term)}`);
      }}
    >
      <Icon name="search" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search orders, products, customers…  ( / )"
        aria-label="Search the admin console"
        role="combobox"
        aria-expanded={open && !!shown}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      {open && shown ? (
        <div className="am-sdrop" id={listId} role="listbox">
          {shown.length === 0 ? (
            <div className="am-sdrop-empty">No matches for “{term}”</div>
          ) : (
            shown.map((h, i) => {
              const head = h.type !== lastType ? <div className="am-sdrop-h">{GROUP[h.type].label}</div> : null;
              lastType = h.type;
              return (
                <div key={h.type + h.id} style={{ display: "contents" }}>
                  {head}
                  <Link
                    id={`${listId}-${i}`}
                    href={h.href}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? "is-active" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      go(h.href);
                    }}
                  >
                    <Icon name={GROUP[h.type].icon} />
                    <span>{h.title}</span>
                    <small>{h.sub}</small>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </form>
  );
}
