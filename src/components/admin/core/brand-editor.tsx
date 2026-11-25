"use client";
/** Brand + category create/edit drawers (POST/PATCH /api/v1/admin/brands|categories). */
import { useState } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Icon } from "@/components/ui/icon";
import {
  CheckField,
  ColorField,
  ConfirmButton,
  Drawer,
  FormError,
  ImageUploader,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  useAdminAction,
  useForm,
} from "@/components/admin/ui";

export type BrandRow = {
  id: string;
  name: string;
  slug: string;
  word: string | null;
  sub: string | null;
  color: string;
  accent: string | null;
  font: string | null;
  fontWeight: number;
  textTransform: string;
  letterSpacing: string;
  italic: boolean;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isOwn: boolean;
  featured: boolean;
  storeActive: boolean;
  storeActiveUntil: string | null;
  sortOrder: number;
};

type Fonts = ReadonlyArray<{ value: string; label: string }>;

const toForm = (b?: BrandRow) => ({
  name: b?.name ?? "",
  slug: b?.slug ?? "",
  word: b?.word ?? "",
  sub: b?.sub ?? "",
  color: b?.color ?? "#17121f",
  accent: b?.accent ?? "",
  font: b?.font ?? "var(--font-geist), sans-serif",
  fontWeight: b?.fontWeight ?? 700,
  textTransform: b?.textTransform ?? "none",
  letterSpacing: b?.letterSpacing ?? "0",
  italic: b?.italic ?? false,
  tagline: b?.tagline ?? "",
  description: b?.description ?? "",
  logoUrl: b?.logoUrl ?? "",
  bannerUrl: b?.bannerUrl ?? "",
  isOwn: b?.isOwn ?? false,
  featured: b?.featured ?? false,
  storeActive: b?.storeActive ?? false,
  storeActiveUntil: b?.storeActiveUntil ? b.storeActiveUntil.slice(0, 10) : "",
  sortOrder: b?.sortOrder ?? 0,
});

export function BrandEditor({ brand, fonts, trigger }: { brand?: BrandRow; fonts: Fonts; trigger: "new" | "edit" }) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors, setValues } = useForm(toForm(brand));
  const { run, busy, lastError } = useAdminAction();
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setFormError(null);
    if (v.name.trim().length < 2) {
      setErrors({ name: "Enter the brand name" });
      return;
    }
    const body = {
      ...v,
      slug: v.slug || undefined,
      accent: v.accent || null,
      word: v.word || null,
      sub: v.sub || null,
      logoUrl: v.logoUrl || null,
      bannerUrl: v.bannerUrl || null,
      tagline: v.tagline || null,
      description: v.description || null,
      storeActiveUntil: v.storeActiveUntil || null,
    };
    const res = await run(brand ? `/api/v1/admin/brands/${brand.id}` : "/api/v1/admin/brands", { method: brand ? "PATCH" : "POST", body }, { success: brand ? "Brand saved" : "Brand added", quietError: true });
    if (res !== null) {
      setOpen(false);
      if (!brand) setValues(toForm());
    }
  }
  const fe = { ...errors, ...(lastError?.fields ?? {}) };

  return (
    <>
      {trigger === "new" ? (
        <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          Add brand
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setValues(toForm(brand)); setOpen(true); }}>
          Edit
        </button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={brand ? `Edit ${brand.name}` : "Add brand"}
        sub="The wordmark is drawn from these settings until you upload a logo."
        size="lg"
        locked={busy}
        onSubmit={save}
        footer={
          <>
            {brand ? (
              <ConfirmButton
                url={`/api/v1/admin/brands/${brand.id}`}
                method="DELETE"
                className="btn btn-ghost btn-sm"
                confirm={`Delete ${brand.name}?`}
                message="Only brands with no products, campaigns or coupons can be deleted."
                confirmLabel="Delete brand"
                tone="danger"
                success="Brand deleted"
              >
                <Icon name="trash" />
                Delete
              </ConfirmButton>
            ) : null}
            <span className="am-sp" />
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : brand ? "Save brand" : "Add brand"}
            </button>
          </>
        }
      >
        <div className="am-form">
          <div className="am-bprev" style={{ background: v.bannerUrl ? `center / cover url(${JSON.stringify(v.bannerUrl)})` : undefined }}>
            <div className="am-bprev-card">
              <BrandLogo
                brand={{
                  name: v.name || "Brand",
                  word: v.word || null,
                  sub: v.sub || null,
                  color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : "#17121f",
                  font: v.font,
                  fontWeight: v.fontWeight,
                  textTransform: v.textTransform,
                  letterSpacing: v.letterSpacing,
                  italic: v.italic,
                  logoUrl: v.logoUrl || null,
                }}
                size={30}
              />
            </div>
            <div className="am-bprev-row">
              {[13, 18].map((sz) => (
                <span key={sz} className="am-bprev-chip">
                  <BrandLogo
                    brand={{ name: v.name || "Brand", word: v.word || null, sub: v.sub || null, color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : "#17121f", font: v.font, fontWeight: v.fontWeight, textTransform: v.textTransform, letterSpacing: v.letterSpacing, italic: v.italic, logoUrl: v.logoUrl || null }}
                    size={sz}
                    showSub={false}
                  />
                </span>
              ))}
              {v.tagline ? <span className="am-bprev-tag">{v.tagline}</span> : null}
            </div>
          </div>
          <FormError message={formError ?? (lastError && !Object.keys(lastError.fields).length ? lastError.message : null)} />
          <div className="am-fgrid">
            <TextField label="Brand name" required value={v.name} onChange={(name) => set({ name })} error={fe.name} maxLength={60} />
            <TextField label="URL slug" value={v.slug} onChange={(slug) => set({ slug })} error={fe.slug} hint={`/brand/${v.slug || "…"}`} mono />
          </div>
          <div className="am-fsec">
            <h3>Wordmark</h3>
            <p>How the name is drawn on cards, ads and the brand store.</p>
            <div className="am-fgrid am-fgrid-3">
              <TextField label="Word (display text)" value={v.word} onChange={(word) => set({ word })} placeholder={v.name || "e.g. L'ORÉAL"} maxLength={40} error={fe.word} />
              <TextField label="Sub-line" value={v.sub} onChange={(sub) => set({ sub })} placeholder="e.g. PARIS" maxLength={20} error={fe.sub} />
              <SelectField label="Font" value={v.font} onChange={(font) => set({ font })} options={fonts.map((f) => ({ value: f.value, label: f.label }))} error={fe.font} />
              <SelectField
                label="Weight"
                value={String(v.fontWeight)}
                onChange={(w) => set({ fontWeight: Number(w) })}
                options={[300, 400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: String(w) }))}
              />
              <SelectField
                label="Letter case"
                value={v.textTransform}
                onChange={(textTransform) => set({ textTransform })}
                options={[
                  { value: "none", label: "As typed" },
                  { value: "uppercase", label: "UPPERCASE" },
                  { value: "lowercase", label: "lowercase" },
                  { value: "capitalize", label: "Capitalised" },
                ]}
              />
              <TextField label="Letter spacing" value={v.letterSpacing} onChange={(letterSpacing) => set({ letterSpacing })} error={fe.letterSpacing} placeholder=".1em" mono />
              <ColorField label="Colour" value={v.color} onChange={(color) => set({ color })} error={fe.color} />
              <ColorField label="Accent (optional)" value={v.accent} onChange={(accent) => set({ accent })} error={fe.accent} />
              <CheckField label="Italic" checked={v.italic} onChange={(italic) => set({ italic })} className="am-check-pad" />
            </div>
          </div>
          <div className="am-fsec">
            <h3>Logo &amp; banner</h3>
            <p>A logo image replaces the drawn wordmark everywhere. The banner is the brand store hero.</p>
            <div className="am-fgrid">
              <div className="am-field">
                <span className="am-field-l">Logo</span>
                <ImageUploader value={v.logoUrl ? [{ url: v.logoUrl }] : []} onChange={(imgs) => set({ logoUrl: imgs[0]?.url ?? "" })} max={1} label="Upload logo" />
              </div>
              <div className="am-field">
                <span className="am-field-l">Brand store banner</span>
                <ImageUploader value={v.bannerUrl ? [{ url: v.bannerUrl }] : []} onChange={(imgs) => set({ bannerUrl: imgs[0]?.url ?? "" })} max={1} label="Upload banner" />
              </div>
            </div>
          </div>
          <div className="am-fsec">
            <h3>Store &amp; listing</h3>
            <TextField label="Tagline" value={v.tagline} onChange={(tagline) => set({ tagline })} maxLength={120} placeholder="Because you're worth it" />
            <TextAreaField label="About the brand" value={v.description} onChange={(description) => set({ description })} rows={3} maxLength={2000} />
            <div className="am-fgrid">
              <CheckField label="Brand store live (slot B1)" hint="Paid brand store page with hero banner" checked={v.storeActive} onChange={(storeActive) => set({ storeActive })} />
              <TextField label="Store paid until" type="date" value={v.storeActiveUntil} onChange={(storeActiveUntil) => set({ storeActiveUntil })} error={fe.storeActiveUntil} />
              <CheckField label="Featured brand" hint="Shown in the brands strip" checked={v.featured} onChange={(featured) => set({ featured })} />
              <CheckField label="TBB Originals (own label)" hint="The client's own brand" checked={v.isOwn} onChange={(isOwn) => set({ isOwn })} />
              <NumberField label="Sort order" value={v.sortOrder} onChange={(n) => set({ sortOrder: n ?? 0 })} min={0} hint="Lower shows first" />
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}

export type CategoryRow = { id: string; name: string; slug: string; short: string | null; description: string | null; imageUrl: string | null; parentId: string | null; sortOrder: number; isActive: boolean };

const catForm = (c?: CategoryRow) => ({
  name: c?.name ?? "",
  slug: c?.slug ?? "",
  short: c?.short ?? "",
  description: c?.description ?? "",
  imageUrl: c?.imageUrl ?? "",
  parentId: c?.parentId ?? "",
  sortOrder: c?.sortOrder ?? 0,
  isActive: c?.isActive ?? true,
});

export function CategoryEditor({ category, parents, trigger }: { category?: CategoryRow; parents: Array<{ id: string; name: string }>; trigger: "new" | "edit" }) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors, setValues } = useForm(catForm(category));
  const { run, busy, lastError } = useAdminAction();
  const fe = { ...errors, ...(lastError?.fields ?? {}) };
  async function save() {
    if (v.name.trim().length < 2) return setErrors({ name: "Enter the category name" });
    const body = { ...v, slug: v.slug || undefined, short: v.short || null, description: v.description || null, imageUrl: v.imageUrl || null, parentId: v.parentId || null };
    const res = await run(category ? `/api/v1/admin/categories/${category.id}` : "/api/v1/admin/categories", { method: category ? "PATCH" : "POST", body }, { success: category ? "Category saved" : "Category added", quietError: true });
    if (res !== null) {
      setOpen(false);
      if (!category) setValues(catForm());
    }
  }
  return (
    <>
      {trigger === "new" ? (
        <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          Add category
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setValues(catForm(category)); setOpen(true); }}>
          Edit
        </button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={category ? `Edit ${category.name}` : "Add category"}
        locked={busy}
        onSubmit={save}
        footer={
          <>
            {category ? (
              <ConfirmButton url={`/api/v1/admin/categories/${category.id}`} method="DELETE" className="btn btn-ghost btn-sm" confirm={`Delete ${category.name}?`} message="Only empty categories can be deleted — hide it instead to keep its products." confirmLabel="Delete" tone="danger" success="Category deleted">
                <Icon name="trash" />
                Delete
              </ConfirmButton>
            ) : null}
            <span className="am-sp" />
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Saving…" : "Save category"}
            </button>
          </>
        }
      >
        <div className="am-form">
          <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
          <div className="am-fgrid">
            <TextField label="Name" required value={v.name} onChange={(name) => set({ name })} error={fe.name} maxLength={60} />
            <TextField label="URL slug" value={v.slug} onChange={(slug) => set({ slug })} error={fe.slug} hint={`/c/${v.slug || "…"}`} mono />
            <TextField label="Short name (menus)" value={v.short} onChange={(short) => set({ short })} maxLength={30} />
            <SelectField label="Parent" value={v.parentId} onChange={(parentId) => set({ parentId })} options={[{ value: "", label: "— Top level —" }, ...parents.filter((p) => p.id !== category?.id).map((p) => ({ value: p.id, label: p.name }))]} error={fe.parentId} />
            <NumberField label="Sort order" value={v.sortOrder} onChange={(n) => set({ sortOrder: n ?? 0 })} min={0} />
            <CheckField label="Visible on the store" checked={v.isActive} onChange={(isActive) => set({ isActive })} className="am-check-pad" />
          </div>
          <TextAreaField label="Description" value={v.description} onChange={(description) => set({ description })} rows={3} maxLength={500} />
          <div className="am-field">
            <span className="am-field-l">Tile image</span>
            <ImageUploader value={v.imageUrl ? [{ url: v.imageUrl }] : []} onChange={(imgs) => set({ imageUrl: imgs[0]?.url ?? "" })} max={1} label="Upload image" />
          </div>
        </div>
      </Drawer>
    </>
  );
}
