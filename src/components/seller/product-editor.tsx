"use client";
/**
 * Product editor (create + edit). Saves through /api/v1/seller/products — new products and content edits go to
 * admin review (PENDING); price/stock-only edits on a live product stay live. Live preview uses the real store card.
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { BrandLite, ProductCardData } from "@/types/shared";
import { discountPct, formatINR } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { Packshot } from "@/components/ui/packshot";
import { ProductCard } from "@/components/ui/product-card";
import { toast } from "@/components/ui/toast";
import { api, ApiFailure, errorText } from "./api";
import { uploadImage } from "./upload";
import { useSellerHref } from "./use-seller-href";
import { PRODUCT_STATUS_LABEL } from "./format";

export type EditorInitial = {
  id: string;
  status: string;
  rejectionReason: string | null;
  name: string;
  brandId: string;
  categoryId: string;
  size: string | null;
  sku: string | null;
  mrp: number;
  price: number;
  stock: number;
  description: string | null;
  howToUse: string | null;
  ingredients: string | null;
  bullets: string[];
  concerns: string[];
  tags: string[];
  images: { url: string; alt: string | null }[];
  art: { shape: string | null; c1: string | null; c2: string | null };
  hasOrders: boolean;
  slug: string;
};

type Props = {
  initial: EditorInitial | null;
  brands: BrandLite[];
  categories: { id: string; slug: string; name: string }[];
  concerns: { slug: string; name: string; emoji: string | null }[];
  commissionPct: number;
};

const SHAPES = ["bottle", "tube", "dropper", "jar", "pump", "stick"] as const;

type Errors = Record<string, string>;

export function ProductEditor({ initial, brands, categories, concerns, commissionPct }: Props) {
  const router = useRouter();
  const href = useSellerHref();
  const isNew = !initial;
  const live = initial?.status === "ACTIVE";

  const [name, setName] = useState(initial?.name ?? "");
  const [brandId, setBrandId] = useState(initial?.brandId ?? (brands.length === 1 ? brands[0].id : ""));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [size, setSize] = useState(initial?.size ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [mrp, setMrp] = useState(initial ? String(initial.mrp) : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [howToUse, setHowToUse] = useState(initial?.howToUse ?? "");
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? "");
  const [bullets, setBullets] = useState<string[]>(initial?.bullets.length ? initial.bullets : [""]);
  const [picked, setPicked] = useState<string[]>(initial?.concerns ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [images, setImages] = useState(initial?.images ?? []);
  const [shape, setShape] = useState<string>(initial?.art.shape ?? "bottle");
  const [c1, setC1] = useState(initial?.art.c1 ?? "#f3e6ff");
  const [c2, setC2] = useState(initial?.art.c2 ?? "#5b35e0");
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const brand = brands.find((b) => b.id === brandId) ?? null;
  const category = categories.find((c) => c.id === categoryId) ?? null;
  const mrpN = Math.round(Number(mrp) || 0);
  const priceN = Math.round(Number(price) || 0);
  const commission = Math.round((priceN * commissionPct) / 100);
  const off = discountPct(mrpN, priceN);

  const preview: ProductCardData | null = !brand
    ? null
    : {
      id: initial?.id ?? "preview",
      slug: initial?.slug ?? "preview",
      name: name || "Your product name",
      size: size || null,
      mrp: mrpN || priceN || 0,
      price: priceN || 0,
      rating: 0,
      reviewCount: 0,
      soldCount: 0,
      badge: null,
      stock: Number(stock) || 0,
      isOwnLabel: false,
      categorySlug: category?.slug ?? "skin",
      brand,
      image: images[0] ? { url: images[0].url, alt: images[0].alt, width: null, height: null } : null,
      art: { shape, c1, c2, line: null },
    };

  function err(field: string) {
    return errors[field] ? (
      <small className="sl-err" id={`e-${field}`}>
        {errors[field]}
      </small>
    ) : null;
  }
  const inv = (field: string) => ({ "aria-invalid": !!errors[field] || undefined, "aria-describedby": errors[field] ? `e-${field}` : undefined });

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, Math.max(0, 8 - images.length));
    if (!list.length) {
      toast("Up to 8 photos per product", { icon: "info" });
      return;
    }
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const m = await uploadImage(f, name ? `${brand?.name ?? ""} ${name}`.trim() : undefined);
        setImages((prev) => (prev.length >= 8 ? prev : [...prev, { url: m.url, alt: null }]));
      } catch (e) {
        toast(errorText(e), { icon: "info" });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function addTag(raw: string) {
    const parts = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2 && t.length <= 40);
    if (!parts.length) return;
    setTags((prev) => [...new Set([...prev, ...parts])].slice(0, 20));
    setTagDraft("");
  }

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 3) e.name = "Enter the product name (at least 3 characters)";
    if (!brandId) e.brandId = "Choose a brand";
    if (!categoryId) e.categoryId = "Choose a category";
    if (!mrpN || mrpN < 1) e.mrp = "Enter the MRP";
    if (!priceN || priceN < 1) e.price = "Enter your selling price";
    else if (mrpN && priceN > mrpN) e.price = "Selling price can't be more than MRP";
    if (stock === "" || Number(stock) < 0 || !Number.isInteger(Number(stock))) e.stock = "Enter stock in whole units";
    if (sku && !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,63}$/.test(sku.trim())) e.sku = "Letters, numbers, - _ . / only";
    return e;
  }

  async function save(submit: boolean) {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast("Please fix the highlighted fields", { icon: "info" });
      document.querySelector<HTMLElement>(`[name="${Object.keys(e)[0]}"]`)?.focus();
      return;
    }
    if (uploading) {
      toast("Wait for the photos to finish uploading", { icon: "clock" });
      return;
    }
    setSaving(submit ? "submit" : "draft");
    const body = {
      name: name.trim(),
      brandId,
      categoryId,
      size: size.trim() || null,
      sku: sku.trim() || null,
      mrp: mrpN,
      price: priceN,
      stock: Number(stock),
      description: description.trim() || null,
      howToUse: howToUse.trim() || null,
      ingredients: ingredients.trim() || null,
      bullets: bullets.map((b) => b.trim()).filter(Boolean),
      concerns: picked,
      tags,
      images,
      shape,
      colorPrimary: c1,
      colorSecondary: c2,
      submit,
    };
    try {
      const out = isNew
        ? await api<{ id: string; status: string }>("/api/v1/seller/products", { body })
        : await api<{ id: string; status: string; reviewRequired?: boolean }>(`/api/v1/seller/products/${initial!.id}`, { method: "PUT", body });
      const msg =
        out.status === "PENDING"
          ? "Sent for review — usually approved within 24 working hours"
          : out.status === "ACTIVE"
            ? "Saved — changes are live"
            : "Saved as draft";
      toast(msg, { icon: "check" });
      router.push(href(`/seller/products${out.status === "ACTIVE" ? "" : `?status=${out.status}`}`));
      router.refresh();
    } catch (ex) {
      if (ex instanceof ApiFailure && Object.keys(ex.fields).length) {
        setErrors(Object.fromEntries(Object.entries(ex.fields).map(([k, v]) => [k, v?.[0] ?? "Check this field"])));
      }
      toast(errorText(ex), { icon: "info" });
      setSaving(null);
    }
  }

  return (
    <form
      className="sl-editor"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
    >
      <div className="sl-form">
        {initial?.status === "REJECTED" && initial.rejectionReason ? (
          <div className="sl-note sl-note-crit">
            <Icon name="info" />
            <span>
              <b>Changes needed:</b> {initial.rejectionReason}
            </span>
          </div>
        ) : null}
        {live ? (
          <div className="sl-note">
            <Icon name="info" />
            <span>
              <b>This product is live.</b> Price and stock changes apply immediately. Changing anything else (name, photos, description, MRP…) sends it back for a quick review and it&apos;s hidden from the store until approved.
            </span>
          </div>
        ) : null}
        {initial?.status === "PENDING" ? (
          <div className="sl-note sl-note-warn">
            <Icon name="clock" />
            <span>
              <b>In review.</b> You can still edit it — saving keeps it in the review queue.
            </span>
          </div>
        ) : null}

        <section className="sl-card sl-form-sec" aria-labelledby="pe-basic">
          <h3 id="pe-basic">
            <Icon name="tag" /> Basics
          </h3>
          <div className="sl-fgrid">
            <label className="sl-field sl-full">
              <span>Product name</span>
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="e.g. Beard & Hair Growth Oil" {...inv("name")} />
              {err("name") ?? <small>Don&apos;t repeat the brand — it&apos;s shown separately.</small>}
            </label>
            <label className="sl-field">
              <span>Brand</span>
              <select name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} {...inv("brandId")}>
                <option value="">Choose a brand…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {err("brandId") ?? <small>Only brands you&apos;re authorised to sell.</small>}
            </label>
            <label className="sl-field">
              <span>Category</span>
              <select name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} {...inv("categoryId")}>
                <option value="">Choose a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err("categoryId")}
            </label>
            <label className="sl-field">
              <span>
                Size / volume <em>(optional)</em>
              </span>
              <input name="size" value={size} onChange={(e) => setSize(e.target.value)} maxLength={40} placeholder="e.g. 50 ml, 100 g" {...inv("size")} />
              {err("size")}
            </label>
            <label className="sl-field">
              <span>
                SKU <em>(optional)</em>
              </span>
              <input name="sku" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} maxLength={64} placeholder="Your internal code" {...inv("sku")} />
              {err("sku") ?? <small>Printed on packing slips.</small>}
            </label>
          </div>
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="pe-price">
          <h3 id="pe-price">
            <Icon name="percent" /> Price &amp; stock
          </h3>
          <div className="sl-fgrid sl-fgrid-3">
            <label className="sl-field">
              <span>MRP</span>
              <span className="sl-rs">
                <i>₹</i>
                <input name="mrp" inputMode="numeric" value={mrp} onChange={(e) => setMrp(e.target.value.replace(/\D/g, ""))} placeholder="449" {...inv("mrp")} />
              </span>
              {err("mrp") ?? <small>As printed on the pack.</small>}
            </label>
            <label className="sl-field">
              <span>Selling price</span>
              <span className="sl-rs">
                <i>₹</i>
                <input name="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="349" {...inv("price")} />
              </span>
              {err("price") ?? <small>{off ? `${off}% off MRP` : "Incl. GST"}</small>}
            </label>
            <label className="sl-field">
              <span>Stock</span>
              <input name="stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} placeholder="100" {...inv("stock")} />
              {err("stock") ?? <small>Units ready to ship.</small>}
            </label>
          </div>
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="pe-photos">
          <h3 id="pe-photos">
            <Icon name="camera" /> Photos
          </h3>
          <p>Up to 8 photos · JPG, PNG or WEBP up to 5 MB · white background, product only. The first photo is the main image.</p>
          <div className="sl-photos">
            {images.map((img, i) => (
              <div className="sl-photo" key={img.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? `Photo ${i + 1}`} />
                {i === 0 ? <span className="sl-photo-main">Main</span> : null}
                <span className="sl-photo-tools">
                  {i > 0 ? (
                    <button type="button" aria-label="Make main photo" title="Make main photo" onClick={() => setImages((p) => [p[i], ...p.filter((_, j) => j !== i)])}>
                      <Icon name="star" />
                    </button>
                  ) : null}
                  <button type="button" aria-label="Remove photo" title="Remove" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>
                    <Icon name="close" />
                  </button>
                </span>
              </div>
            ))}
            {images.length < 8 ? (
              <label
                className={over ? "sl-drop is-over" : "sl-drop"}
                aria-busy={uploading > 0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
              >
                <Icon name="upload" />
                {uploading ? `Uploading ${uploading}…` : "Add photos"}
                <small>or drop them here</small>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  multiple
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
          {errors.images ? <small className="sl-err">{errors.images}</small> : null}
          {!images.length ? (
            <div className="sl-field">
              <span>No photo yet? Pick a packshot style</span>
              <small>Until your photos are ready we show a clean illustrated pack in your colours.</small>
              <div className="sl-shapes" role="group" aria-label="Packshot shape">
                {SHAPES.map((s) => (
                  <button key={s} type="button" className="sl-shape" aria-pressed={shape === s} aria-label={s} title={s} onClick={() => setShape(s)}>
                    <Packshot art={{ shape: s, c1, c2 }} name={name || "Product"} brand={{ name: brand?.name ?? "Brand", word: brand?.word ?? null, isOwn: false }} labelled={false} />
                  </button>
                ))}
              </div>
              <div className="sl-colors">
                <label>
                  <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} aria-label="Pack colour" /> Pack colour
                </label>
                <label>
                  <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} aria-label="Label / cap colour" /> Label &amp; cap
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="pe-desc">
          <h3 id="pe-desc">
            <Icon name="info" /> Description
          </h3>
          <label className="sl-field">
            <span>About this product</span>
            <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={5} placeholder="What it does, who it's for and what makes it different." {...inv("description")} />
            {err("description")}
          </label>
          <fieldset className="sl-field" style={{ border: 0 }}>
            <legend>
              Key benefits <span className="sl-muted" style={{ fontWeight: 500 }}>(up to 8 bullet points)</span>
            </legend>
            <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={b}
                    maxLength={200}
                    aria-label={`Benefit ${i + 1}`}
                    placeholder={i === 0 ? "e.g. Visibly fuller beard in 4 weeks" : "Another benefit"}
                    onChange={(e) => setBullets((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <button type="button" className="ib-sm" aria-label={`Remove benefit ${i + 1}`} onClick={() => setBullets((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [""]))}>
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
              {bullets.length < 8 ? (
                <button type="button" className="link" style={{ justifySelf: "start" }} onClick={() => setBullets((p) => [...p, ""])}>
                  <Icon name="plus" /> Add a benefit
                </button>
              ) : null}
            </div>
          </fieldset>
          <div className="sl-fgrid">
            <label className="sl-field">
              <span>
                How to use <em>(optional)</em>
              </span>
              <textarea name="howToUse" value={howToUse} onChange={(e) => setHowToUse(e.target.value)} maxLength={3000} rows={4} />
            </label>
            <label className="sl-field">
              <span>
                Ingredients <em>(optional)</em>
              </span>
              <textarea name="ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} maxLength={5000} rows={4} />
            </label>
          </div>
        </section>

        <section className="sl-card sl-form-sec" aria-labelledby="pe-find">
          <h3 id="pe-find">
            <Icon name="search" /> Help shoppers find it
          </h3>
          <fieldset className="sl-field" style={{ border: 0 }}>
            <legend>Concerns it solves</legend>
            <div className="sl-checks" style={{ marginTop: 6 }}>
              {concerns.map((c) => (
                <label key={c.slug} className="sl-check">
                  <input
                    type="checkbox"
                    checked={picked.includes(c.slug)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.slug] : p.filter((x) => x !== c.slug)))}
                  />
                  <Icon name="check" />
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="sl-field">
            <span>
              Search keywords <em>(optional)</em>
            </span>
            <span className="sl-tagin">
              {tags.map((t) => (
                <span className="sl-tag" key={t}>
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((p) => p.filter((x) => x !== t))}>
                    <Icon name="close" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                placeholder={tags.length ? "Add more…" : "e.g. beard oil, beard growth"}
                onChange={(e) => {
                  if (e.target.value.endsWith(",")) addTag(e.target.value);
                  else setTagDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                  if (e.key === "Backspace" && !tagDraft && tags.length) setTags((p) => p.slice(0, -1));
                }}
                onBlur={() => tagDraft && addTag(tagDraft)}
              />
            </span>
            <small>Press Enter or comma after each keyword. Up to 20.</small>
          </label>
        </section>

        <div className="sl-sticky-act">
          {initial ? <small>Status: {PRODUCT_STATUS_LABEL[initial.status] ?? initial.status}</small> : <small>New products are reviewed within 24 working hours.</small>}
          <span className="sl-spacer" />
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Cancel
          </button>
          {!live ? (
            <button type="button" className="btn btn-ghost" disabled={!!saving} onClick={() => save(false)}>
              {saving === "draft" ? "Saving…" : "Save draft"}
            </button>
          ) : null}
          <button type="submit" className="btn btn-cart" disabled={!!saving}>
            <Icon name="check" /> {saving === "submit" ? "Saving…" : live ? "Save changes" : "Submit for review"}
          </button>
        </div>
      </div>

      <aside className="sl-editor-side" aria-label="Preview">
        <div className="sl-card sl-preview">
          <span className="sl-preview-l">
            <Icon name="eye" /> Shopper preview
          </span>
          {preview ? <ProductCard product={preview} showGift /> : <p className="sl-muted" style={{ fontSize: 13 }}>Choose a brand to see how your product card looks in the store.</p>}
        </div>
        <div className="sl-card">
          <div className="sl-card-h" style={{ marginBottom: 10 }}>
            <div>
              <h2>Your earnings per unit</h2>
              <p>{commissionPct}% commission · no listing or collection fees</p>
            </div>
          </div>
          <div className="sl-earn">
            <div>
              <span>Selling price</span>
              <b className="num">{formatINR(priceN)}</b>
            </div>
            <div>
              <span>Commission ({commissionPct}%)</span>
              <b className="num">−{formatINR(commission)}</b>
            </div>
            <div className="tot">
              <span>You earn</span>
              <b className="num">{formatINR(Math.max(0, priceN - commission))}</b>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
