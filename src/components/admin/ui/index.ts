/**
 * ADMIN UI KIT — shared building blocks for every /admin page (admin-core + admin-growth). Import from
 * "@/components/admin/ui". Styles live in src/styles/admin/admin.css (loaded by the console layout), so pages
 * only add page-specific CSS (core.css / growth.css). Visual language = docs/theme-reference admin (am-*).
 *
 * PAGE SKELETON (Cache Components: anything reading cookies/DB/searchParams must sit inside <Suspense>,
 * and each page needs its own boundary because client navigations only re-render below the layout):
 *
 *   export default function Page({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
 *     return (<>
 *       <PageHeader title="Campaigns" sub="Brand bookings from the Advertise page" actions={…} />
 *       <Suspense fallback={<SkeletonPage />}><Content searchParams={searchParams} /></Suspense>
 *     </>);
 *   }
 *   async function Content({ searchParams }) {
 *     await requireAdminPage("/admin/campaigns");          // (or requireSuperAdmin… for ADMIN-only pages)
 *     const params = flatParams(await searchParams);
 *     …query…; return <Card>…<DataTable …/><Pagination …/></Card>;
 *   }
 *
 * SERVER-COMPATIBLE (no hooks — use anywhere)
 *   PageHeader({ title, sub?, back?: {href,label}, actions?, badge? })        page title row
 *   Card({ title?, sub?, actions?, children, className?, id? })               white block `.blk.am-card`
 *   StatGrid({ children, cols? }) + StatCard({ label, value, unit?, sub?, href?, tone?: cta|crit|warn, meter?: 0..1 })
 *   KpiCard({ label, value, delta?, sub?, href?, hero? }) + Delta({ value, suffix?, label? })   dashboard tiles
 *   StatusPill({ kind: order|item|payment|product|seller|campaign|payout, status, label? }) · Pill({ tone, children })
 *   statusLabel(kind, status)                                                  human label for an enum value
 *   DataTable<T>({ rows, columns: Column<T>[], rowKey, basePath?, params?, sort?, empty?, small?, minWidth? })
 *       Column: { key, label, render(row), sortable?: "<sort key>", align?: right|center, main?, actions?, hideMobile? }
 *       sort headers are links that set ?sort=<key>&dir=asc|desc — read them in your query.
 *   Pagination({ basePath, params, page, pages, total, limit, noun? })        ?page= links
 *   FilterChips({ basePath, params, param, options: {value,label,count?}[], label })   status chips (links)
 *   LinkTabs({ items: {href,label,active,count?}[], label })                   section tabs (links)
 *   EmptyState({ icon?, title, children?, action?, ok? })
 *   KeyValues({ rows: [label, value][] })                                      definition list
 *   SkeletonPage / SkeletonTable / SkeletonStats                               Suspense fallbacks
 *   format helpers: formatINR, compactINR, fmtDay, fmtDate, fmtDateTime, fmtTime, fmtAgo, isoDay, initials,
 *     avatarTint, pct, plural, flatParams(searchParams), hrefWith(base, params, patch)
 *
 * CLIENT COMPONENTS ("use client" islands — render them inside the page's <Suspense> content)
 *   Toolbar({ search?: {param?, placeholder?}, filters?: {param,label,options,allLabel?}[], dateRange?: {from,to} })
 *       URL-driven: updates the query string (debounced search) → Server Component re-renders.
 *   Switch({ checked, onChange, label, disabled?, busy? })                    `.am-sw`
 *   ApiSwitch({ checked, url, field, method?, label, showState?, onText?, offText?, successOn?, successOff? })
 *       optimistic toggle → `{ [field]: next }` to the API → toast → router.refresh()
 *   Modal / Drawer({ open, onClose, title, sub?, footer?, size?: sm|md|lg, onSubmit?, locked? })   native <dialog>
 *   ActionButton({ url, method?, body?, success?, redirect?, className?, children })         one-click API call
 *   ConfirmButton({ …ActionButton, confirm: "title", message?, confirmLabel?, tone?: primary|danger|ok,
 *                   reason?: { label, field, required?, placeholder? } })                    confirm modal (+ reason)
 *   Fields: Field, TextField, NumberField, MoneyField (₹ integer), TextAreaField, SelectField, CheckField,
 *           TagsField, ColorField, MultiToggle, FormError + useForm(initial) → { values, set, errors, setErrors }
 *   ImageUploader({ value: {url,alt?}[], onChange, max?, endpoint? })        uploads to POST /api/v1/admin/media
 *   useAdminAction() → { run(url, {method, body}, {success, redirect, refresh, quietError}), busy, lastError }
 *   adminFetch(url, {method, body}) / AdminApiError / fieldErrors(details)    raw JSON client for /api/v1
 *   toast(message, { icon }) is re-exported from the store UI kit (the console layout mounts <Toaster/>).
 *
 * CSS CLASSES (admin.css) you can use directly: am-grid + am-span4/5/6/7/8/12, am-sec/am-sec-h, am-kpis, am-stats,
 * am-table, am-pill-*, am-tag(-pz|-own|-violet), am-meter(-pz|-stock), am-fill, am-rank, am-att, am-sid, am-segctl,
 * am-legend, am-tip, am-chips/chip, am-cust/am-cav, am-gchips/am-gchip, am-fgrid(-3|-4), am-field, am-dl, am-kvs,
 * am-iconbtn, btn-danger, btn-ok. Demo classes specific to the ads/campaign pages (am-slots, am-camp, am-cre, am-where,
 * am-map, am-hint) are NOT in admin.css — port them into growth.css.
 */
export * from "./layout";
export * from "./status-pill";
export * from "./data-table";
export * from "./format";
export { Toolbar, type ToolbarFilter } from "./toolbar";
export { Switch, ApiSwitch } from "./switch";
export { Modal, Drawer } from "./modal";
export { ActionButton, ConfirmButton } from "./confirm-button";
export {
  Field,
  TextField,
  NumberField,
  MoneyField,
  TextAreaField,
  SelectField,
  CheckField,
  TagsField,
  ColorField,
  MultiToggle,
  FormError,
  useForm,
  type Option,
} from "./fields";
export { ImageUploader, type UploadedImage } from "./image-uploader";
export { useAdminAction, adminFetch, AdminApiError, fieldErrors, type ApiFailure, type RunOptions } from "./use-admin-action";
export { toast } from "@/components/ui/toast";
