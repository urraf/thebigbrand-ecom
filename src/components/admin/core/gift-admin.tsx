"use client";
/** Free-gift engine controls: gift editor drawer, restock dialog and the tier-rules editor (ported from the demo). */
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/money";
import { CheckField, ConfirmButton, Drawer, FormError, Modal, MoneyField, NumberField, SelectField, TextField, useAdminAction, useForm } from "@/components/admin/ui";

export type GiftRow = { id: string; productId: string; miniName: string; miniSize: string; worth: number; stock: number; isActive: boolean; sortOrder: number };
type OwnProduct = { id: string; name: string; size: string | null; price: number; taken: boolean; giftItemId: string | null };

const giftForm = (g?: GiftRow) => ({
  productId: g?.productId ?? "",
  miniName: g?.miniName ?? "",
  miniSize: g?.miniSize ?? "",
  worth: g?.worth ?? (null as number | null),
  stock: g?.stock ?? (0 as number | null),
  isActive: g?.isActive ?? true,
  sortOrder: g?.sortOrder ?? (0 as number | null),
});

export function GiftEditor({ gift, products, trigger }: { gift?: GiftRow; products: OwnProduct[]; trigger: "new" | "edit" }) {
  const [open, setOpen] = useState(false);
  const { values: v, set, errors, setErrors, setValues } = useForm(giftForm(gift));
  const { run, busy, lastError } = useAdminAction();
  const fe = { ...errors, ...(lastError?.fields ?? {}) };
  const choices = products.filter((p) => !p.taken || p.giftItemId === gift?.id);

  async function save() {
    const local: Record<string, string> = {};
    if (!gift && !v.productId) local.productId = "Choose the full-size product";
    if (v.miniName.trim().length < 3) local.miniName = "Name the mini";
    if (v.miniSize.trim().length < 2) local.miniSize = "e.g. 30 ml mini";
    if (!v.worth || v.worth < 1) local.worth = "Worth in ₹ shown to shoppers";
    if (Object.keys(local).length) return setErrors(local);
    const body = gift
      ? { miniName: v.miniName, miniSize: v.miniSize, worth: v.worth, stock: v.stock ?? 0, isActive: v.isActive, sortOrder: v.sortOrder ?? 0 }
      : { productId: v.productId, miniName: v.miniName, miniSize: v.miniSize, worth: v.worth, stock: v.stock ?? 0, isActive: v.isActive, sortOrder: v.sortOrder ?? 0 };
    const res = await run(gift ? `/api/v1/admin/gifts/${gift.id}` : "/api/v1/admin/gifts", { method: gift ? "PATCH" : "POST", body }, { success: gift ? "Gift saved — live at checkout" : "Gift added to checkout", icon: "gift", quietError: true });
    if (res !== null) {
      setOpen(false);
      if (!gift) setValues(giftForm());
    }
  }

  return (
    <>
      {trigger === "new" ? (
        <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          Add gift
        </button>
      ) : (
        <button type="button" className="am-iconbtn" aria-label={`Edit ${gift?.miniName}`} onClick={() => { setValues(giftForm(gift)); setOpen(true); }}>
          <Icon name="sliders" />
        </button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={gift ? `Edit ${gift.miniName}` : "Add a free gift"}
        sub="Gifts are minis of TBB Originals products — shoppers pick them before paying."
        locked={busy}
        onSubmit={save}
        footer={
          <>
            {gift ? (
              <ConfirmButton url={`/api/v1/admin/gifts/${gift.id}`} method="DELETE" className="btn btn-ghost btn-sm" confirm={`Delete ${gift.miniName}?`} message="Only gifts never given in an order can be deleted — switch it off instead to keep the history." confirmLabel="Delete" tone="danger" success="Gift deleted">
                <Icon name="trash" />
                Delete
              </ConfirmButton>
            ) : null}
            <span className="am-sp" />
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? "Saving…" : gift ? "Save gift" : "Add gift"}
            </button>
          </>
        }
      >
        <div className="am-form">
          <FormError message={lastError && !Object.keys(lastError.fields).length ? lastError.message : null} />
          <SelectField
            label="Full-size TBB Original"
            required
            value={v.productId}
            onChange={(productId) => {
              const p = products.find((x) => x.id === productId);
              set({ productId, ...(p && !v.miniName ? { miniName: p.name } : {}) });
            }}
            placeholder="Choose a product"
            disabled={!!gift}
            options={choices.map((p) => ({ value: p.id, label: `${p.name}${p.size ? ` · ${p.size}` : ""} · ${formatINR(p.price)}` }))}
            error={fe.productId}
            hint={gift ? "The full-size product can't be changed — add a new gift instead" : choices.length ? "Shoppers who try the mini can buy this full size" : "Every TBB Original already has a gift"}
          />
          <div className="am-fgrid">
            <TextField label="Mini name" required value={v.miniName} onChange={(miniName) => set({ miniName })} maxLength={80} error={fe.miniName} placeholder="Vitamin C Glow Face Wash" />
            <TextField label="Mini size" required value={v.miniSize} onChange={(miniSize) => set({ miniSize })} maxLength={30} error={fe.miniSize} placeholder="30 ml mini" />
            <MoneyField label="Worth (shown to shoppers)" required value={v.worth} onChange={(worth) => set({ worth })} error={fe.worth} />
            <NumberField label="Minis in stock" value={v.stock} onChange={(stock) => set({ stock })} min={0} suffix="units" error={fe.stock} />
            <NumberField label="Sort order" value={v.sortOrder} onChange={(sortOrder) => set({ sortOrder })} min={0} hint="Lower shows first at checkout" />
            <CheckField label="Show at checkout" checked={v.isActive} onChange={(isActive) => set({ isActive })} className="am-check-pad" />
          </div>
        </div>
      </Drawer>
    </>
  );
}

export function RestockButton({ id, name, low }: { id: string; name: string; low: boolean }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<number | null>(500);
  const { run, busy } = useAdminAction();
  return (
    <>
      <button type="button" className={low ? "btn btn-sm btn-dark" : "btn btn-sm btn-ghost"} onClick={() => setOpen(true)}>
        <Icon name="plus" />
        Restock
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Restock ${name}`}
        sub="Adds to the current stock count"
        size="sm"
        locked={busy}
        onSubmit={async () => {
          if (!qty || qty < 1) return;
          const ok = await run(`/api/v1/admin/gifts/${id}`, { method: "PATCH", body: { addStock: qty } }, { success: `${qty} minis added`, icon: "box" });
          if (ok !== null) setOpen(false);
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark" disabled={busy || !qty}>
              {busy ? "Saving…" : `Add ${qty ?? 0} minis`}
            </button>
          </>
        }
      >
        <div className="am-form">
          <NumberField label="Minis received" value={qty} onChange={setQty} min={1} max={100000} suffix="units" />
          <div className="am-multi">
            {[100, 250, 500, 1000].map((n) => (
              <button key={n} type="button" aria-pressed={qty === n} onClick={() => setQty(n)}>
                +{n}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}

type Tier = { minAmount: number; giftCount: number };
const norm = (t: Tier[]) => [...t].map((x) => ({ minAmount: Math.max(0, Math.round(x.minAmount || 0)), giftCount: x.giftCount })).sort((a, b) => a.minAmount - b.minAmount);

export function TierEditor({ tiers: live, activeGifts }: { tiers: Tier[]; activeGifts: number }) {
  const [draft, setDraft] = useState<Tier[]>(() => norm(live).length ? norm(live) : [{ minAmount: 0, giftCount: 1 }]);
  const [error, setError] = useState<{ msg: string; bad: number[] } | null>(null);
  const { run, busy } = useAdminAction();
  const dirty = JSON.stringify(norm(draft)) !== JSON.stringify(norm(live));
  const preview = useMemo(() => norm(draft), [draft]);
  const maxCount = Math.min(5, Math.max(1, activeGifts));

  function patch(i: number, p: Partial<Tier>) {
    setError(null);
    setDraft((d) => d.map((t, k) => (k === i ? { ...t, ...p } : t)));
  }

  function validate(): boolean {
    const t = draft.map((x, i) => ({ ...x, minAmount: i === 0 ? 0 : Math.round(Number(x.minAmount) || 0), i }));
    const zero = t.slice(1).filter((x) => x.minAmount <= 0).map((x) => x.i);
    if (zero.length) return fail("Each extra tier needs a cart value above ₹0.", zero);
    const sorted = [...t].sort((a, b) => a.minAmount - b.minAmount);
    const dup = sorted.filter((x, k) => sorted.some((y, j) => j !== k && y.minAmount === x.minAmount)).map((x) => x.i);
    if (dup.length) return fail("Two tiers start at the same cart value — make each one different.", dup);
    const low = sorted.filter((x, k) => k && x.giftCount <= sorted[k - 1].giftCount).map((x) => x.i);
    if (low.length) return fail("A higher cart value must unlock more gifts than the tier before it.", low);
    const over = t.filter((x) => x.giftCount > activeGifts).map((x) => x.i);
    if (over.length) return fail(`Only ${activeGifts} gift${activeGifts === 1 ? " is" : "s are"} switched on — a tier can't offer more than that.`, over);
    return true;
  }
  function fail(msg: string, bad: number[]) {
    setError({ msg, bad });
    return false;
  }

  async function publish() {
    if (!validate()) return;
    const tiers = norm(draft.map((x, i) => (i === 0 ? { ...x, minAmount: 0 } : x)));
    const ok = await run("/api/v1/admin/gifts/tiers", { method: "PUT", body: { tiers } }, { success: "Gift rules published — live on the website & app now", icon: "upload", quietError: true });
    if (ok === null) setError({ msg: "Couldn't publish — check the rules and try again.", bad: [] });
    else setDraft(tiers);
  }

  return (
    <section className="blk am-card am-tiers-card" aria-labelledby="am-ti-h">
      <header className="am-card-h">
        <div>
          <h2 id="am-ti-h">Gift tier rules</h2>
          <p>How many free gifts a customer can choose, by cart value. Bigger carts, more gifts — it lifts average order value.</p>
        </div>
        <span className={`am-tier-state${dirty ? " dirty" : ""}`}>
          {dirty ? (
            "Unpublished changes"
          ) : (
            <>
              <Icon name="check" />
              Live on website &amp; app
            </>
          )}
        </span>
      </header>
      <div className="am-tiers-grid">
        <div>
          <div className="am-tiers" role="list">
            {draft.map((t, i) => (
              <div className={`am-tier${error?.bad.includes(i) ? " is-bad" : ""}`} role="listitem" key={i}>
                <span className="am-tier-n">{i + 1}</span>
                <label className="am-tier-f">
                  <span>{i === 0 ? "Applies to" : "Cart value from"}</span>
                  {i === 0 ? (
                    <b className="am-tier-all">Every order (₹0+)</b>
                  ) : (
                    <span className="am-rsin am-tier-rs">
                      <i>₹</i>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={50}
                        value={t.minAmount || ""}
                        onChange={(e) => patch(i, { minAmount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                        aria-label={`Tier ${i + 1} starts at cart value in rupees`}
                      />
                    </span>
                  )}
                </label>
                <span className="am-tier-ar" aria-hidden="true">
                  <Icon name="arrow" />
                </span>
                <div className="am-tier-f am-tier-c">
                  <span>Free gifts</span>
                  <div className="am-step" role="group" aria-label={`Tier ${i + 1} free gifts`}>
                    <button type="button" onClick={() => patch(i, { giftCount: Math.max(1, t.giftCount - 1) })} aria-label="One gift fewer" disabled={t.giftCount <= 1}>
                      <Icon name="minus" />
                    </button>
                    <output aria-live="polite">{t.giftCount}</output>
                    <button type="button" onClick={() => patch(i, { giftCount: Math.min(maxCount, t.giftCount + 1) })} aria-label="One gift more" disabled={t.giftCount >= maxCount}>
                      <Icon name="plus" />
                    </button>
                  </div>
                </div>
                {i === 0 ? (
                  <span className="am-tier-x" aria-hidden="true" />
                ) : (
                  <button type="button" className="am-iconbtn is-danger am-tier-x" onClick={() => { setError(null); setDraft((d) => d.filter((_, k) => k !== i)); }} aria-label={`Remove tier ${i + 1}`}>
                    <Icon name="trash" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="am-tier-act">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={draft.length >= 6}
              onClick={() => {
                const last = draft[draft.length - 1];
                setDraft((d) => [...d, { minAmount: (last?.minAmount ?? 0) + 1000, giftCount: Math.min(maxCount, (last?.giftCount ?? 0) + 1) }]);
              }}
            >
              <Icon name="plus" />
              Add tier
            </button>
            {dirty ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(null); setDraft(norm(live)); }}>
                Discard changes
              </button>
            ) : null}
          </div>
        </div>
        <aside className="am-tier-prev">
          <small>What shoppers see at checkout</small>
          <ul>
            {preview.map((t, i) => (
              <li key={i}>
                <span>{i === 0 && !t.minAmount ? "Every order" : `Orders ${formatINR(t.minAmount)}+`}</span>
                <Icon name="arrow" />
                <b>
                  {t.giftCount} free gift{t.giftCount > 1 ? "s" : ""}
                </b>
              </li>
            ))}
          </ul>
          {error ? (
            <p className="am-tier-err" role="alert">
              <Icon name="info" />
              <span>{error.msg}</span>
            </p>
          ) : null}
          <button type="button" className="btn btn-cart btn-lg" onClick={publish} disabled={busy || !dirty} aria-busy={busy || undefined}>
            <Icon name="upload" />
            {busy ? "Publishing…" : "Publish to website & app"}
          </button>
          <p>Goes live for every shopper instantly — no app update needed. {activeGifts} gift{activeGifts === 1 ? "" : "s"} are switched on.</p>
        </aside>
      </div>
    </section>
  );
}
