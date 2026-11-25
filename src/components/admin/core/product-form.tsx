"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/ui/product-image";
import { discountPct, formatINR } from "@/lib/money";
import {
  Card,
  CheckField,
  ColorField,
  FormError,
  ImageUploader,
  MoneyField,
  MultiToggle,
  NumberField,
  SelectField,
  TagsField,
  TextAreaField,
  TextField,
  adminFetch,
  AdminApiError,
  toast,
  useForm,
  type UploadedImage,
} from "@/components/admin/ui";

export type ProductFormOptions = {
  brands: Array<{ id: string; name: string; slug: string; isOwn: boolean }>;
  categories: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  sellers: Array<{ id: string; displayName: string; status: string }>;
  concerns: Array<{ slug: string; name: string }>;
  shapes: readonly string[];
};

export type ProductFormValues = {
  name: string;
  slug: string;
  brandId: string;
  categoryId: string;
  sellerId: string;
  sku: string;
  size: string;
  mrp: number | null;
  price: number | null;
  stock: number | null;
  status: string;
  badge: string;
  description: string;
  howToUse: string;
  ingredients: string;
  bullets: string;
  concerns: string[];
  tags: string[];
  shape: string;
  colorPrimary: string;
  colorSecondary: string;
  line: string;
  isFeatured: boolean;
  isOwnLabel: boolean;
  images: UploadedImage[];
  rejectionReason: string;
};

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  slug: "",
  brandId: "",
  categoryId: "",
  sellerId: "",
  sku: "",
  size: "",
  mrp: null,
  price: null,
  stock: 0,
  status: "DRAFT",
  badge: "",
  description: "",
  howToUse: "",
  ingredients: "",
  bullets: "",
  concerns: [],
  tags: [],
  shape: "bottle",
  colorPrimary: "#f3ece4",
  colorSecondary: "#5b35e0",
  line: "",
  isFeatured: false,
  isOwnLabel: false,
  images: [],
  rejectionReason: "",
};

const slugOf = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const STATUS_OPTS = [
  { value: "DRAFT", label: "Draft — hidden from the store" },
  { value: "ACTIVE", label: "Active — live on the store" },
  { value: "PENDING", label: "Pending approval" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
];

export function ProductForm({ id, initial, options, storeSlug }: { id?: string; initial?: ProductFormValues | null; options: ProductFormOptions; storeSlug?: string }) {
  const { values: v, set, errors, setErrors } = useForm<ProductFormValues>(initial ?? EMPTY_PRODUCT);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const brand = options.brands.find((b) => b.id === v.brandId);
  const off = v.mrp && v.price ? discountPct(v.mrp, v.price) : 0;

  const previewProduct = useMemo(
    () => ({
      name: v.name || "Product name",
      image: v.images[0] ? { url: v.images[0].url, alt: v.images[0].alt ?? null, width: null, height: null } : null,
      art: { shape: v.shape || "bottle", c1: v.colorPrimary || null, c2: v.colorSecondary || null, line: v.line || null },
      isOwnLabel: v.isOwnLabel,
      brand: { name: brand?.name ?? "Brand", word: brand?.name ?? "BRAND", isOwn: brand?.isOwn ?? false },
    }),
    [v.name, v.images, v.shape, v.colorPrimary, v.colorSecondary, v.line, v.isOwnLabel, brand],
  );

  async function save() {
    setFormError(null);
    const local: Record<string, string> = {};
    if (v.name.trim().length < 3) local.name = "Enter the product name";
    if (!v.brandId) local.brandId = "Choose a brand";
    if (!v.categoryId) local.categoryId = "Choose a category";
    if (!v.mrp) local.mrp = "Enter the MRP";
    if (!v.price) local.price = "Enter the selling price";
    if (v.mrp && v.price && v.price > v.mrp) local.price = "Price can't be higher than MRP";
    if (v.stock == null || v.stock < 0) local.stock = "Stock can't be negative";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError("Please fix the highlighted fields");
      return;
    }
    const body = {
      name: v.name.trim(),
      slug: v.slug.trim() || undefined,
      brandId: v.brandId,
      categoryId: v.categoryId,
      sellerId: v.sellerId || null,
      sku: v.sku.trim() || null,
      size: v.size.trim() || null,
      mrp: v.mrp,
      price: v.price,
      stock: v.stock ?? 0,
      status: v.status,
      badge: v.badge.trim() || null,
      description: v.description.trim() || null,
      howToUse: v.howToUse.trim() || null,
      ingredients: v.ingredients.trim() || null,
      bullets: v.bullets
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
      concerns: v.concerns,
      tags: v.tags,
      shape: v.shape || null,
      colorPrimary: v.colorPrimary || null,
      colorSecondary: v.colorSecondary || null,
      line: v.line.trim() || null,
      isFeatured: v.isFeatured,
      isOwnLabel: v.isOwnLabel,
      images: v.images.map((i) => ({ url: i.url, alt: i.alt ?? null })),
      rejectionReason: v.status === "REJECTED" ? v.rejectionReason.trim() || null : null,
    };
    setBusy(true);
    try {
      const res = await adminFetch<{ id: string; slug: string }>(id ? `/api/v1/admin/products/${id}` : "/api/v1/admin/products", { method: id ? "PATCH" : "POST", body });
      toast(id ? "Product saved" : "Product created", { icon: "check" });
      if (id) router.refresh();
      else router.push(`/admin/products/${res.id}?created=1`);
    } catch (e) {
      const f = e instanceof AdminApiError ? e.failure : null;
      if (f?.fields && Object.keys(f.fields).length) setErrors(f.fields);
      setFormError(f?.message ?? "Couldn't save the product");
      toast(f?.message ?? "Couldn't save the product", { icon: "info" });
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <div className="am-pform-act">
          <FormError message={formError} />
          <button type="submit" className="btn btn-cart btn-lg" disabled={busy} aria-busy={busy || undefined}>
            <Icon name="check" />
            {busy ? "Saving…" : id ? "Save changes" : "Create product"}
          </button>
          {id && storeSlug && v.status === "ACTIVE" ? (
            <Link className="btn btn-ghost" href={`/p/${storeSlug}`} target="_blank">
              <Icon name="eye" />
              View on store
            </Link>
          ) : null}
        </div>
  );

  return (
    <form
      className="am-pform"
      onSubmit={async (e) => {
        e.preventDefault();
        await save();
      }}
      noValidate
    >
      <ProductFormBody v={v} set={set} errors={errors} options={options} slugTouched={slugTouched} setSlugTouched={setSlugTouched} off={off} />
      <aside className="am-pform-side">
        <Card title="Preview" sub="How the product card looks on the store">
          <div className="am-pprev">
            <ProductImage product={previewProduct} sizes="260px" className="am-pprev-img" />
            <small className="am-pprev-brand">{brand?.name ?? "Brand"}</small>
            <b className="am-pprev-name">{v.name || "Product name"}</b>
            <div className="price">
              <span className="pr">
                <sup>₹</sup>
                {(v.price ?? 0).toLocaleString("en-IN")}
              </span>
              {v.mrp && v.price && v.mrp > v.price ? (
                <>
                  <span className="mrp">
                    M.R.P: <s>{formatINR(v.mrp)}</s>
                  </span>
                  <span className="off">({off}% off)</span>
                </>
              ) : null}
            </div>
            {v.badge ? <span className="pc-badge am-pprev-badge">{v.badge}</span> : null}
          </div>
        </Card>
        <Card title="Visibility">
          <div className="am-form">
            <SelectField label="Status" value={v.status} onChange={(status) => set({ status })} options={STATUS_OPTS} error={errors.status} />
            {v.status === "REJECTED" ? (
              <TextAreaField label="Rejection reason (seller sees this)" value={v.rejectionReason} onChange={(rejectionReason) => set({ rejectionReason })} rows={2} maxLength={300} />
            ) : null}
            <CheckField label="Featured" hint="Eligible for homepage picks" checked={v.isFeatured} onChange={(isFeatured) => set({ isFeatured })} />
            <CheckField label="TBB Originals full-size" hint="Own-label product (can have a free-gift mini)" checked={v.isOwnLabel} onChange={(isOwnLabel) => set({ isOwnLabel })} />
          </div>
        </Card>
        {actions}
      </aside>
      <div className="am-pform-mbar">
        {actions}
      </div>
    </form>
  );
}

function ProductFormBody({
  v,
  set,
  errors,
  options,
  slugTouched,
  setSlugTouched,
  off,
}: {
  v: ProductFormValues;
  set: (p: Partial<ProductFormValues>) => void;
  errors: Record<string, string>;
  options: ProductFormOptions;
  slugTouched: boolean;
  setSlugTouched: (b: boolean) => void;
  off: number;
}) {
  return (
    <div className="am-pform-main">
      <Card title="Basics">
        <div className="am-fgrid">
          <TextField
            wide
            label="Product name"
            required
            value={v.name}
            onChange={(name) => set(slugTouched ? { name } : { name, slug: slugOf(name) })}
            error={errors.name}
            maxLength={160}
            placeholder="e.g. Vitamin C Face Serum with 10% Niacinamide"
          />
          <TextField
            wide
            label="URL slug"
            value={v.slug}
            onChange={(slug) => {
              setSlugTouched(true);
              set({ slug: slugOf(slug) });
            }}
            error={errors.slug}
            hint={`thebigbrands.co.in/p/${v.slug || "…"} — used for SEO, keep it short`}
            mono
          />
          <SelectField
            label="Brand"
            required
            value={v.brandId}
            onChange={(brandId) => set({ brandId })}
            placeholder="Choose a brand"
            options={options.brands.map((b) => ({ value: b.id, label: b.isOwn ? `${b.name} (TBB Originals)` : b.name }))}
            error={errors.brandId}
          />
          <SelectField
            label="Category"
            required
            value={v.categoryId}
            onChange={(categoryId) => set({ categoryId })}
            placeholder="Choose a category"
            options={options.categories.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (hidden)` }))}
            error={errors.categoryId}
          />
          <SelectField
            label="Sold by"
            value={v.sellerId}
            onChange={(sellerId) => set({ sellerId })}
            options={[{ value: "", label: "The Big Brands Retail" }, ...options.sellers.map((s) => ({ value: s.id, label: s.status === "APPROVED" ? s.displayName : `${s.displayName} (${s.status.toLowerCase()})` }))]}
            error={errors.sellerId}
          />
          <TextField label="SKU" value={v.sku} onChange={(sku) => set({ sku: sku.toUpperCase() })} error={errors.sku} maxLength={40} placeholder="TBB-VITC-30" mono />
          <TextField label="Size" value={v.size} onChange={(size) => set({ size })} error={errors.size} maxLength={40} placeholder="30 ml" />
          <TextField label="Badge" value={v.badge} onChange={(badge) => set({ badge })} error={errors.badge} maxLength={30} placeholder="Bestseller, Derm pick…" />
        </div>
      </Card>

      <Card title="Price & stock" sub="Integer rupees. Price is what the customer pays (GST inclusive).">
        <div className="am-fgrid am-fgrid-3">
          <MoneyField label="MRP" required value={v.mrp} onChange={(mrp) => set({ mrp })} error={errors.mrp} />
          <MoneyField
            label="Selling price"
            required
            value={v.price}
            onChange={(price) => set({ price })}
            error={errors.price}
            hint={off ? `${off}% off MRP` : undefined}
          />
          <NumberField label="Stock" required value={v.stock} onChange={(stock) => set({ stock })} min={0} suffix="units" error={errors.stock} hint={v.stock === 0 ? "Out of stock — can't be added to cart" : undefined} />
        </div>
      </Card>

      <Card title="Images" sub="First image is the cover. JPG, PNG or WEBP up to 5 MB. Products without photos show the packshot below.">
        <ImageUploader value={v.images} onChange={(images) => set({ images })} max={8} />
      </Card>

      <Card title="Description">
        <div className="am-form">
          <TextAreaField label="About this product" value={v.description} onChange={(description) => set({ description })} rows={5} maxLength={5000} error={errors.description} />
          <TextAreaField
            label="Key benefits (one per line)"
            value={v.bullets}
            onChange={(bullets) => set({ bullets })}
            rows={4}
            hint="Shown as bullet points on the product page — up to 8"
            error={errors.bullets}
          />
          <div className="am-fgrid">
            <TextAreaField label="How to use" value={v.howToUse} onChange={(howToUse) => set({ howToUse })} rows={3} maxLength={3000} />
            <TextAreaField label="Ingredients" value={v.ingredients} onChange={(ingredients) => set({ ingredients })} rows={3} maxLength={4000} />
          </div>
        </div>
      </Card>

      <Card title="Discovery" sub="Concerns power the “Shop by concern” tiles; tags are extra search keywords.">
        <div className="am-form">
          <MultiToggle label="Skin & hair concerns" value={v.concerns} onChange={(concerns) => set({ concerns })} options={options.concerns.map((c) => ({ value: c.slug, label: c.name }))} error={errors.concerns} />
          <TagsField label="Search tags" value={v.tags} onChange={(tags) => set({ tags })} lowercase placeholder="vitamin c, glow, serum…" error={errors.tags} />
        </div>
      </Card>

      <Card title="Packshot (when there's no photo)" sub="The store draws an SVG pack in these colours — used for TBB Originals until photos arrive.">
        <div className="am-fgrid am-fgrid-4">
          <SelectField label="Pack shape" value={v.shape} onChange={(shape) => set({ shape })} options={options.shapes.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
          <ColorField label="Body colour" value={v.colorPrimary} onChange={(colorPrimary) => set({ colorPrimary })} error={errors.colorPrimary} />
          <ColorField label="Cap / label colour" value={v.colorSecondary} onChange={(colorSecondary) => set({ colorSecondary })} error={errors.colorSecondary} />
          <TextField label="Label line" value={v.line} onChange={(line) => set({ line })} maxLength={30} placeholder="VITAMIN C" />
        </div>
      </Card>
    </div>
  );
}
