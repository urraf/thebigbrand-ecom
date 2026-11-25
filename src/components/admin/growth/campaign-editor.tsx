"use client";
/**
 * Campaign editor with a live preview of the creative in its slot.
 *   create: POST  /api/v1/admin/campaigns          (optionally { approve: true } → live immediately)
 *   edit:   PATCH /api/v1/admin/campaigns/:id
 * Image uploads go to POST /api/v1/admin/campaigns/media (storeUpload). Product search: GET /api/v1/admin/campaigns/products.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ProductVisual } from "@/components/ui/product-image";
import {
  adminFetch,
  AdminApiError,
  CheckField,
  ColorField,
  Field,
  FormError,
  MoneyField,
  NumberField,
  SelectField,
  TagsField,
  TextAreaField,
  TextField,
  toast,
  useForm,
} from "@/components/admin/ui";
import type { BrandLite, ProductCardData } from "@/types/shared";
import { CreativePreview } from "./creative-preview";

type SlotOpt = { code: string; name: string; page: string; pageLabel: string; size: string; format: string; pricingModel: string; rate: number; rateLabel: string; isActive: boolean; positions: number };
export type EditorOptionsLite = {
  slots: SlotOpt[];
  advertisers: Array<{ id: string; name: string; brandId: string | null }>;
  brands: BrandLite[];
  concerns: Array<{ slug: string; name: string; emoji: string | null }>;
};

export type EditorInitial = {
  id?: string;
  code?: string;
  status?: string;
  name: string;
  slotCode: string;
  advertiserId: string;
  brandId: string;
  isHouse: boolean;
  kicker: string;
  headline: string;
  subline: string;
  ctaLabel: string;
  linkUrl: string;
  imageUrl: string;
  mobileImageUrl: string;
  videoUrl: string;
  themeBg: string;
  themeFg: string;
  themeAccent: string;
  layout: string;
  products: ProductCardData[];
  targetKey: string;
  keywords: string[];
  meta: Array<[string, string]>;
  startDay: string;
  endDay: string;
  pricingModel: string;
  rate: number | null;
  budget: number | null;
  priority: number | null;
  weight: number | null;
  paymentStatus: string;
};

type Values = EditorInitial;

const PAGES = ["home", "search", "product", "cart", "success", "brand", "offline"];
const MODELS = [
  { value: "DAY", label: "Per day (flat)" },
  { value: "WEEK", label: "Per week (flat)" },
  { value: "MONTH", label: "Per month (flat)" },
  { value: "CPM", label: "Per 1,000 views (CPM)" },
  { value: "CPC", label: "Per click (CPC)" },
  { value: "CLIP", label: "Per coupon clip" },
  { value: "BOX", label: "Per delivery box" },
];
const PAYMENT = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "WAIVED", label: "Waived (house / goodwill)" },
];
const BG_PRESETS = [
  "linear-gradient(120deg,#ff3d6e 0%,#ff6a4d 55%,#ffb347 100%)",
  "linear-gradient(120deg,#3a0d52,#6a1b9a 60%,#9c4dcc)",
  "linear-gradient(135deg,#2a0614,#7a0f33 60%,#c2185b)",
  "linear-gradient(120deg,#0c3b2e,#0f6b4f 60%,#23a37a)",
  "linear-gradient(120deg,#0b1f4d,#1d4fb8 60%,#4f86f7)",
  "linear-gradient(120deg,#f6edff 0%,#e4ccff 60%,#c9a2ff 100%)",
  "linear-gradient(120deg,#fff0f5,#ffe3ee)",
  "#eef7ee",
  "#140a24",
];
const FLAT = ["DAY", "WEEK", "MONTH"];
const STRIP_HINT: Record<string, string> = { H3: "1500×120 strip — keep the headline short", S2: "Banner above search results", C2: "Banner on the order confirmation page" };

const dayCount = (a: string, b: string) => {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1);
};

function flatCost(model: string, rate: number, days: number) {
  if (model === "DAY") return Math.round(rate * days);
  if (model === "WEEK") return Math.round((rate / 7) * days);
  if (model === "MONTH") return Math.round((rate / 30) * days);
  return 0;
}

function Sec({ icon, title, sub, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="ag-ed-sec">
      <h3>
        <Icon name={icon} />
        {title}
      </h3>
      {sub ? <p>{sub}</p> : null}
      {children}
    </section>
  );
}

// ───────────────────────────── image field ─────────────────────────────

function ImageField({ label, value, onChange, hint, error }: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(f: File) {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(f.type)) return toast("Only JPG, PNG, WEBP, AVIF or GIF images", { icon: "info" });
    if (f.size > 5 * 1024 * 1024) return toast("Image must be 5 MB or smaller", { icon: "info" });
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await adminFetch<{ url: string }>("/api/v1/admin/campaigns/media", { method: "POST", body: fd });
      onChange(res.url);
      toast("Image uploaded", { icon: "upload" });
    } catch (e) {
      toast(e instanceof AdminApiError ? e.message : "Upload failed", { icon: "info" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="ag-img-pick">
        <div className="ag-img-box">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary upload / URL */}
          {value ? <img src={value} alt="" /> : busy ? "Uploading…" : "No image"}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… or https://…" aria-label={`${label} URL`} />
          <div className="ag-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()} disabled={busy}>
              <Icon name="upload" />
              {busy ? "Uploading…" : "Upload"}
            </button>
            {value ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
                <Icon name="trash" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </Field>
  );
}

// ───────────────────────────── product picker ─────────────────────────────

function ProductPicker({ value, onChange, brandId, max = 12 }: { value: ProductCardData[]; onChange: (v: ProductCardData[]) => void; brandId: string; max?: number }) {
  const [q, setQ] = useState("");
  const [onlyBrand, setOnlyBrand] = useState(Boolean(brandId));
  const [res, setRes] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "12" });
        if (q.trim()) qs.set("q", q.trim());
        if (onlyBrand && brandId) qs.set("brandId", brandId);
        setRes(await adminFetch<ProductCardData[]>(`/api/v1/admin/campaigns/products?${qs}`));
      } catch {
        setRes([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, onlyBrand, brandId, open]);

  const ids = new Set(value.map((p) => p.id));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const n = [...value];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {value.length ? (
        <div className="ag-picked">
          {value.map((p, i) => (
            <div className="ag-picked-i" key={p.id}>
              <span className="ag-thumb" style={{ position: "relative" }}>
                <ProductVisual product={p} sizes="40px" decorative />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>{p.name}</b>
                <small>
                  {p.brand.name} · ₹{p.price.toLocaleString("en-IN")} · {p.stock > 0 ? `${p.stock} in stock` : "out of stock"}
                </small>
              </span>
              <span className="ag-picked-t">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`}>
                  <Icon name="chevLeft" style={{ transform: "rotate(90deg)" }} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move ${p.name} down`}>
                  <Icon name="chevDown" />
                </button>
                <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                  <Icon name="close" />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="am-muted" style={{ fontSize: 12.5 }}>
          No products yet — creatives with products show their packshots/photos and link shoppers straight to them.
        </p>
      )}
      <div className="ag-row">
        <div className="am-toolbar" style={{ margin: 0, flex: 1 }}>
          <div className="am-tb-q" style={{ maxWidth: "none" }}>
            <Icon name="search" />
            <input
              type="search"
              value={q}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              placeholder="Search products to add…"
              aria-label="Search products to add"
            />
          </div>
        </div>
        {brandId ? (
          <label className="am-check" style={{ fontSize: 12.5 }}>
            <input type="checkbox" checked={onlyBrand} onChange={(e) => setOnlyBrand(e.target.checked)} />
            <span>This brand only</span>
          </label>
        ) : null}
      </div>
      {open ? (
        <div className="ag-search-res" role="listbox" aria-label="Product results" aria-busy={loading || undefined}>
          {res.length === 0 ? (
            <p className="am-muted" style={{ padding: 10, fontSize: 13 }}>
              {loading ? "Searching…" : "No active products match"}
            </p>
          ) : (
            res.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={ids.has(p.id)}
                disabled={ids.has(p.id) || value.length >= max}
                onClick={() => onChange([...value, p])}
              >
                <span className="ag-thumb" style={{ position: "relative" }}>
                  <ProductVisual product={p} sizes="36px" decorative />
                </span>
                <span style={{ minWidth: 0 }}>
                  <b>{p.name}</b>
                  <small>
                    {p.brand.name} · ₹{p.price.toLocaleString("en-IN")}
                  </small>
                </span>
                <Icon name={ids.has(p.id) ? "check" : "plus"} size={16} />
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────────── editor ─────────────────────────────

export function CampaignEditor({
  initial,
  options,
  mode,
  readOnly,
  readOnlyReason,
}: {
  initial: EditorInitial;
  options: EditorOptionsLite;
  mode: "create" | "edit";
  readOnly?: boolean;
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const { values: v, set, errors, setErrors } = useForm<Values>(initial);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState<false | "save" | "approve">(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(v) !== saved;

  const slot = options.slots.find((s) => s.code === v.slotCode) ?? options.slots[0];
  const brand = options.brands.find((b) => b.id === v.brandId) ?? null;
  const days = dayCount(v.startDay, v.endDay);
  const rate = Number(v.rate) || 0;
  const flat = FLAT.includes(v.pricingModel);
  const cost = flat ? flatCost(v.pricingModel, rate, days) : Number(v.budget) || 0;

  // warn before leaving with unsaved edits
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty && !readOnly) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, readOnly]);

  const slotGroups = useMemo(
    () =>
      PAGES.map((p) => ({
        label: options.slots.find((s) => s.page === p)?.pageLabel ?? p,
        options: options.slots.filter((s) => s.page === p).map((s) => ({ value: s.code, label: `${s.code} · ${s.name} — ${s.rateLabel}${s.isActive ? "" : " (paused)"}` })),
      })).filter((g) => g.options.length),
    [options.slots],
  );

  function pickSlot(code: string) {
    const s = options.slots.find((x) => x.code === code);
    if (!s) return;
    // a new slot brings its rate card unless the admin already customised the price
    const priceUntouched = rate === slot.rate && v.pricingModel === slot.pricingModel;
    set({ slotCode: code, ...(priceUntouched || mode === "create" ? { pricingModel: s.pricingModel, rate: s.rate } : {}), targetKey: "" });
  }

  function pickAdvertiser(id: string) {
    const a = options.advertisers.find((x) => x.id === id);
    set({ advertiserId: id, ...(a?.brandId && !v.brandId ? { brandId: a.brandId } : {}) });
  }

  const preview = {
    slotCode: v.slotCode,
    slotSize: slot?.size,
    isHouse: v.isHouse,
    brand,
    kicker: v.kicker,
    headline: v.headline,
    subline: v.subline,
    ctaLabel: v.ctaLabel,
    imageUrl: v.imageUrl,
    mobileImageUrl: v.mobileImageUrl,
    videoUrl: v.videoUrl,
    theme: { bg: v.themeBg || undefined, fg: v.themeFg || undefined, accent: v.themeAccent || undefined },
    layout: v.layout,
    products: v.products,
    targetKey: v.targetKey,
    keywords: v.keywords,
    meta: Object.fromEntries(v.meta.filter(([k]) => k.trim())) as Record<string, unknown>,
  };

  function body(approve = false) {
    const meta: Record<string, string | number> = {};
    for (const [k, val] of v.meta) {
      const key = k.trim();
      if (!key) continue;
      meta[key] = /^-?\d+(\.\d+)?$/.test(val.trim()) ? Number(val.trim()) : val.trim();
    }
    return {
      name: v.name.trim(),
      slotCode: v.slotCode,
      advertiserId: v.isHouse ? null : v.advertiserId || null,
      brandId: v.brandId || null,
      isHouse: v.isHouse,
      kicker: v.kicker,
      headline: v.headline,
      subline: v.subline,
      ctaLabel: v.ctaLabel,
      linkUrl: v.linkUrl,
      imageUrl: v.imageUrl,
      mobileImageUrl: v.mobileImageUrl,
      videoUrl: v.videoUrl,
      theme: { bg: v.themeBg, fg: v.themeFg, accent: v.themeAccent },
      layout: v.layout || null,
      productIds: v.products.map((p) => p.id),
      targetKey: v.targetKey,
      keywords: v.keywords,
      meta,
      startsAt: v.startDay ? `${v.startDay}T00:00:00+05:30` : "",
      endsAt: v.endDay ? `${v.endDay}T23:59:59+05:30` : "",
      pricingModel: v.pricingModel,
      rate: Number(v.rate) || 0,
      budget: Number(v.budget) || 0,
      priority: Number(v.priority) || 0,
      weight: Math.max(1, Number(v.weight) || 1),
      paymentStatus: v.isHouse && v.paymentStatus === "UNPAID" ? "WAIVED" : v.paymentStatus,
      ...(approve ? { approve: true } : {}),
    };
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Give the campaign a name";
    if (v.headline.trim().length < 2) e.headline = "Headline is required";
    if (!v.startDay) e.startsAt = "Pick a start date";
    if (!v.endDay) e.endsAt = "Pick an end date";
    else if (v.startDay && v.endDay < v.startDay) e.endsAt = "End date must be after the start";
    if (!v.isHouse && !v.advertiserId && !v.brandId) e.advertiserId = "Pick an advertiser or brand (or mark it as a house campaign)";
    if (v.linkUrl && !(v.linkUrl.startsWith("/") || /^https:\/\//i.test(v.linkUrl))) e.linkUrl = "Use a site path like /brand/plum or a full https:// link";
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields");
      return false;
    }
    return true;
  }

  async function save(approve = false) {
    setFormError(null);
    if (!validate()) return;
    setBusy(approve ? "approve" : "save");
    try {
      if (mode === "create") {
        const res = await adminFetch<{ id: string; code: string; state: string }>("/api/v1/admin/campaigns", { method: "POST", body: body(approve) });
        setSaved(JSON.stringify(v));
        toast(approve ? `${res.code} approved — ${res.state === "LIVE" ? "live on the storefront now" : "it will go live on its start date"}` : `${res.code} saved as a draft`, { icon: "check" });
        router.push(approve ? `/admin/campaigns?approved=${res.id}` : `/admin/campaigns/${res.id}`);
      } else {
        await adminFetch(`/api/v1/admin/campaigns/${initial.id}`, { method: "PATCH", body: body() });
        setSaved(JSON.stringify(v));
        toast(initial.status === "APPROVED" ? "Saved — the live creative is updated on the storefront" : "Campaign saved", { icon: "check" });
        router.refresh();
      }
    } catch (e) {
      if (e instanceof AdminApiError) {
        setErrors(e.failure.fields);
        setFormError(e.failure.message);
      } else setFormError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const targetField = (() => {
    if (v.slotCode === "H4")
      return (
        <SelectField
          label="Concern tile"
          value={v.targetKey}
          onChange={(targetKey) => set({ targetKey })}
          placeholder="Choose a concern…"
          options={options.concerns.map((c) => ({ value: c.slug, label: `${c.emoji ?? ""} ${c.name}`.trim() }))}
          hint="“Presented by” appears on this shop-by-concern tile"
        />
      );
    if (v.slotCode === "B1")
      return (
        <SelectField
          label="Brand store"
          value={v.targetKey}
          onChange={(targetKey) => set({ targetKey })}
          placeholder="Choose a brand…"
          options={options.brands.filter((b) => !b.isOwn).map((b) => ({ value: b.slug, label: b.name }))}
          hint="Approving switches this brand's paid storefront on for the flight"
        />
      );
    if (["S3", "P1", "C1", "S4", "P2"].includes(v.slotCode))
      return (
        <TextField
          label="Target"
          value={v.targetKey}
          onChange={(targetKey) => set({ targetKey })}
          placeholder={v.slotCode === "P2" ? "category slug or product id (optional)" : "product id (optional — defaults to the first product)"}
          hint="Narrows where the placement serves"
          mono
        />
      );
    return null;
  })();

  const checks: Array<{ ok: boolean; text: string }> = [
    { ok: v.headline.trim().length >= 2 && v.headline.length <= (["H3", "S2", "C2", "S1"].includes(v.slotCode) ? 70 : 140), text: v.headline.length > 70 && ["H3", "S2", "C2", "S1"].includes(v.slotCode) ? "Headline is long for a strip — under 70 characters reads best" : "Headline fits the slot" },
    ["S3", "S4", "P1", "C1"].includes(v.slotCode) && !v.linkUrl
      ? { ok: v.products.length > 0, text: v.products.length ? "Cards link to the product pages" : "Add a product — cards link to it" }
      : { ok: Boolean(v.linkUrl), text: v.linkUrl ? "Click-through link set" : "No click-through link — shoppers can't tap through" },
    { ok: !["S3", "P1", "C1", "H11", "H10", "S4"].includes(v.slotCode) || v.products.length > 0, text: ["S3", "P1", "C1", "H11", "H10", "S4"].includes(v.slotCode) ? (v.products.length ? `${v.products.length} product${v.products.length === 1 ? "" : "s"} attached` : "This slot needs at least one product") : "Products optional for this format" },
    { ok: slot?.isActive ?? true, text: slot?.isActive ? `Slot ${slot.code} is live` : `Slot ${slot?.code} is paused — resume it in Ads Manager to serve` },
    { ok: days > 0, text: days ? `${days}-day flight` : "Set the flight dates" },
  ];

  return (
    <div className="ag-ed">
      <div className="blk am-card ag-ed-form-wrap">
        <form
          className="ag-ed-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!readOnly) save(false);
          }}
          noValidate
        >
          {readOnly ? (
            <div className="ag-note ag-note-warn">
              <Icon name="info" />
              <div>{readOnlyReason ?? "This campaign can no longer be edited."}</div>
            </div>
          ) : null}
          <fieldset disabled={readOnly || Boolean(busy)} style={{ border: 0, display: "grid", gap: 20, minWidth: 0 }}>
            <Sec icon="target" title="Placement & advertiser">
              <div className="am-fgrid">
                <TextField wide label="Campaign name" required value={v.name} onChange={(name) => set({ name })} error={errors.name} maxLength={120} placeholder="e.g. Plum · Leaderboard Strip · Winter" />
                <SelectField wide label="Ad slot" required value={v.slotCode} onChange={pickSlot} groups={slotGroups} error={errors.slotCode} hint={slot ? `${slot.pageLabel} · ${slot.format} · ${slot.size} · ${slot.positions} position${slot.positions === 1 ? "" : "s"}` : undefined} />
                <div className="am-wide">
                  <CheckField
                    label="House campaign (The Big Brands)"
                    hint="Your own promo: labelled “The Big Brands” instead of “Ad”, billed ₹0, fills unsold space"
                    checked={v.isHouse}
                    onChange={(isHouse) => set({ isHouse, ...(isHouse ? { paymentStatus: "WAIVED", advertiserId: "" } : v.paymentStatus === "WAIVED" ? { paymentStatus: "UNPAID" } : {}) })}
                  />
                </div>
                {!v.isHouse ? (
                  <SelectField
                    label="Advertiser"
                    value={v.advertiserId}
                    onChange={pickAdvertiser}
                    placeholder="Choose an advertiser…"
                    options={options.advertisers.map((a) => ({ value: a.id, label: a.name }))}
                    error={errors.advertiserId}
                    hint={<a className="link" href="/admin/advertisers?new=1" target="_blank" rel="noopener">+ New advertiser</a>}
                  />
                ) : null}
                <SelectField label="Brand on the creative" value={v.brandId} onChange={(brandId) => set({ brandId })} placeholder={v.isHouse ? "The Big Brands (house)" : "Choose a brand…"} options={options.brands.map((b) => ({ value: b.id, label: b.name }))} error={errors.brandId} />
              </div>
            </Sec>

            <Sec icon="sparkle" title="Creative" sub={STRIP_HINT[v.slotCode] ?? "What shoppers see. The preview updates as you type."}>
              <div className="am-fgrid">
                <TextField label="Kicker" value={v.kicker} onChange={(kicker) => set({ kicker })} maxLength={60} placeholder="e.g. Hair Fall Week" error={errors.kicker} />
                <TextField label="Button label" value={v.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} maxLength={40} placeholder="Shop now" error={errors.ctaLabel} />
                <TextField wide label="Headline" required value={v.headline} onChange={(headline) => set({ headline })} maxLength={140} placeholder="Less hair fall. More hair days." error={errors.headline} hint={`${v.headline.length}/140`} />
                <TextAreaField wide label="Subline" rows={2} value={v.subline} onChange={(subline) => set({ subline })} maxLength={220} placeholder="Onion oil + shampoo combos — up to 30% off" error={errors.subline} />
                <TextField wide label="Click-through link" value={v.linkUrl} onChange={(linkUrl) => set({ linkUrl })} maxLength={500} placeholder="/brand/mamaearth or https://…" error={errors.linkUrl} hint="Clicks are tracked through /api/v1/ads/click before redirecting here" />
                <div className="am-wide">
                  <ImageField label="Image (desktop)" value={v.imageUrl} onChange={(imageUrl) => set({ imageUrl })} error={errors.imageUrl} hint="Lifestyle / banner photo — JPG, PNG, WEBP, AVIF or GIF up to 5 MB. Leave empty to use colours + product packshots." />
                </div>
                <div className="am-wide">
                  <ImageField label="Image (phones, optional)" value={v.mobileImageUrl} onChange={(mobileImageUrl) => set({ mobileImageUrl })} error={errors.mobileImageUrl} />
                </div>
                {["H5", "H6"].includes(v.slotCode) ? (
                  <TextField wide label="Video URL" value={v.videoUrl} onChange={(videoUrl) => set({ videoUrl })} placeholder="https://… .mp4" error={errors.videoUrl} hint="MP4 (H.264). Plays muted; the image above is the poster." />
                ) : null}
                <Field wide label="Background" error={errors.theme}>
                  <div className="ag-swatches" role="group" aria-label="Background presets">
                    {BG_PRESETS.map((b) => (
                      <button key={b} type="button" style={{ background: b }} aria-pressed={v.themeBg === b} aria-label={`Use background ${b}`} onClick={() => set({ themeBg: b })} />
                    ))}
                    <button type="button" aria-pressed={!v.themeBg} onClick={() => set({ themeBg: "" })} aria-label="Brand colour (default)" style={{ background: brand?.color ?? "#33195a" }} title="Brand colour" />
                  </div>
                  <input type="text" value={v.themeBg} onChange={(e) => set({ themeBg: e.target.value })} placeholder="Brand colour by default — or #hex / linear-gradient(…)" aria-label="Background CSS value" />
                </Field>
                <ColorField label="Text colour" value={v.themeFg} onChange={(themeFg) => set({ themeFg })} />
                <ColorField label="Button colour" value={v.themeAccent} onChange={(themeAccent) => set({ themeAccent })} />
                {["H1", "B1"].includes(v.slotCode) ? (
                  <SelectField
                    label="Layout"
                    value={v.layout}
                    onChange={(layout) => set({ layout })}
                    options={[
                      { value: "", label: "Default" },
                      { value: "split", label: "Split — text left, products right" },
                      { value: "center", label: "Centred text" },
                      { value: "image", label: "Full image" },
                    ]}
                  />
                ) : null}
              </div>
            </Sec>

            <Sec icon="bag" title="Products" sub="Shown inside the creative (packshot or photo) — the first one leads.">
              <ProductPicker value={v.products} onChange={(products) => set({ products })} brandId={v.brandId} />
            </Sec>

            <Sec icon="filter" title="Targeting">
              <div className="am-fgrid">
                {targetField}
                {["S1", "S2", "S3", "S4"].includes(v.slotCode) || v.keywords.length ? (
                  <TagsField wide={!targetField} label="Search keywords" value={v.keywords} onChange={(keywords) => set({ keywords })} lowercase max={25} placeholder="serum, vitamin c… (Enter)" hint="Serves when the shopper's search contains one of these" />
                ) : null}
                {!targetField && !(["S1", "S2", "S3", "S4"].includes(v.slotCode) || v.keywords.length) ? (
                  <p className="am-muted am-wide" style={{ fontSize: 12.5 }}>
                    {slot?.code} serves to every shopper on the {slot?.pageLabel.toLowerCase()} — no targeting needed.
                  </p>
                ) : null}
              </div>
              <details>
                <summary className="ag-link" style={{ cursor: "pointer", fontSize: 13 }}>
                  Format extras ({v.meta.length})
                </summary>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <p className="am-muted" style={{ fontSize: 12.5 }}>
                    e.g. reels: creator, handle, views · deal of the day: dealPrice
                  </p>
                  {v.meta.map(([k, val], i) => (
                    <div className="ag-meta-row" key={i}>
                      <input value={k} onChange={(e) => set({ meta: v.meta.map((m, j) => (j === i ? [e.target.value, m[1]] : m)) })} placeholder="key" aria-label={`Extra ${i + 1} key`} maxLength={40} />
                      <input value={val} onChange={(e) => set({ meta: v.meta.map((m, j) => (j === i ? [m[0], e.target.value] : m)) })} placeholder="value" aria-label={`Extra ${i + 1} value`} maxLength={300} />
                      <button type="button" className="ib-sm" onClick={() => set({ meta: v.meta.filter((_, j) => j !== i) })} aria-label={`Remove extra ${i + 1}`}>
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => set({ meta: [...v.meta, ["", ""]] })} disabled={v.meta.length >= 12}>
                    <Icon name="plus" />
                    Add extra
                  </button>
                </div>
              </details>
            </Sec>

            <Sec icon="calendar" title="Schedule & billing">
              <div className="am-fgrid">
                <TextField label="Starts" type="date" required value={v.startDay} onChange={(startDay) => set({ startDay })} error={errors.startsAt} />
                <TextField label="Ends" type="date" required value={v.endDay} onChange={(endDay) => set({ endDay })} error={errors.endsAt} hint={days ? `${days} day${days === 1 ? "" : "s"} (IST)` : undefined} />
                <SelectField label="Pricing model" value={v.pricingModel} onChange={(pricingModel) => set({ pricingModel })} options={MODELS} error={errors.pricingModel} hint={slot ? `Rate card: ${slot.rateLabel}` : undefined} />
                <NumberField label="Rate" prefix="₹" min={0} step={v.pricingModel === "CLIP" || v.pricingModel === "BOX" ? 0.01 : 1} value={v.rate} onChange={(r) => set({ rate: r })} error={errors.rate} hint={v.isHouse ? "House campaigns bill ₹0 whatever the rate" : undefined} />
                <MoneyField label={flat ? "Budget cap (optional)" : "Budget cap"} value={v.budget} onChange={(budget) => set({ budget })} error={errors.budget} hint={flat ? "0 = no cap; flat slots bill rate × days" : "Stops serving once spend reaches this (0 = no cap)"} />
                <SelectField label="Payment" value={v.paymentStatus} onChange={(paymentStatus) => set({ paymentStatus })} options={PAYMENT} />
                <NumberField label="Priority" min={-100} max={100} value={v.priority} onChange={(priority) => set({ priority })} hint="Higher serves first in the slot" />
                <NumberField label="Rotation weight" min={1} max={100} value={v.weight} onChange={(weight) => set({ weight })} hint="Share of rotations among equal priority" />
              </div>
              <div className="ag-cost">
                <span>{v.isHouse ? "House campaign" : flat ? "Booking value" : "Spend cap"}</span>
                <b>{v.isHouse ? "₹0" : cost ? `₹${cost.toLocaleString("en-IN")}` : "No cap"}</b>
                <span>
                  {v.isHouse
                    ? "Fills unsold positions with your own promo"
                    : flat
                      ? `₹${rate.toLocaleString("en-IN")} ${MODELS.find((m) => m.value === v.pricingModel)?.label.toLowerCase()} × ${days} day${days === 1 ? "" : "s"}`
                      : `Billed ${MODELS.find((m) => m.value === v.pricingModel)?.label.toLowerCase()} at ₹${rate.toLocaleString("en-IN")} until the cap`}
                </span>
              </div>
            </Sec>
          </fieldset>
          <FormError message={formError} />
          {!readOnly ? (
            <div className="ag-ed-bar">
              <button type="submit" className="btn btn-dark" disabled={Boolean(busy) || (mode === "edit" && !dirty)}>
                {busy === "save" ? "Saving…" : mode === "create" ? "Save as draft" : "Save changes"}
              </button>
              {mode === "create" ? (
                <button type="button" className="btn btn-cart" onClick={() => save(true)} disabled={Boolean(busy)}>
                  <Icon name="check" />
                  {busy === "approve" ? "Approving…" : "Save & approve"}
                </button>
              ) : null}
              {dirty ? <span className="ag-dirty">Unsaved changes</span> : mode === "edit" ? <span className="am-muted" style={{ fontSize: 12.5 }}>All changes saved</span> : null}
            </div>
          ) : null}
        </form>
      </div>

      <aside className="ag-ed-side" aria-label="Live preview">
        <div className="blk am-card" style={{ display: "grid", gap: 12 }}>
          <div className="ag-prev-tabs">
            <small className="am-prev-l">
              <Icon name="eye" />
              Shopper preview · {slot?.code} {slot?.size}
            </small>
            <div className="am-segctl" role="group" aria-label="Preview device">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
                <Icon name="grid" />
                Desktop
              </button>
              <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
                <Icon name="phone" />
                Phone
              </button>
            </div>
          </div>
          <div className={device === "mobile" ? "ag-prev-frame is-mob" : "ag-prev-frame"}>
            <CreativePreview c={preview} device={device} />
          </div>
          <ul className="ag-checks-k" aria-label="Pre-flight checks">
            {checks.map((c) => (
              <li key={c.text} className={c.ok ? undefined : "no"}>
                <Icon name={c.ok ? "check" : "info"} />
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
