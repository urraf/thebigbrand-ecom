"use client";
import { useState } from "react";
import type { AddressView } from "@/server/checkout/types";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { capi, errMessage } from "../api";
import { AddressCard, AddressForm } from "../address-form";

/** Address book CRUD (GET/POST/PATCH/DELETE /api/v1/account/addresses). */
export function AddressBook({ initial, defaultName, defaultPhone }: { initial: AddressView[]; defaultName: string | null; defaultPhone: string | null }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<"new" | string | null>(initial.length ? null : "new");

  const sorted = (l: AddressView[]) => [...l].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));

  const onSaved = (a: AddressView) => {
    setList((l) => sorted([...l.filter((x) => x.id !== a.id).map((x) => (a.isDefault ? { ...x, isDefault: false } : x)), a]));
    toast(editing === "new" ? "Address saved" : "Address updated", { icon: "check" });
    setEditing(null);
  };

  const remove = async (a: AddressView) => {
    if (!window.confirm(`Delete the address for ${a.name}, ${a.city}?`)) return;
    try {
      const r = await capi<{ defaultId: string | null }>(`/api/v1/account/addresses/${encodeURIComponent(a.id)}`, { method: "DELETE" });
      setList((l) => sorted(l.filter((x) => x.id !== a.id).map((x) => (x.id === r.defaultId ? { ...x, isDefault: true } : x))));
      toast("Address deleted", { icon: "trash" });
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    }
  };

  const makeDefault = async (a: AddressView) => {
    try {
      const saved = await capi<AddressView>(`/api/v1/account/addresses/${encodeURIComponent(a.id)}`, { method: "PATCH", json: { isDefault: true } });
      setList((l) => sorted([saved, ...l.filter((x) => x.id !== a.id).map((x) => ({ ...x, isDefault: false }))]));
      toast(`${a.label ?? "Address"} is now your default`, { icon: "check" });
    } catch (e) {
      toast(errMessage(e), { icon: "info" });
    }
  };

  return (
    <>
      {editing ? (
        <div className="cm-ab-form">
          <h2 className="cm-h2">{editing === "new" ? "Add a new address" : "Edit address"}</h2>
          <AddressForm
            key={editing}
            address={editing === "new" ? null : list.find((a) => a.id === editing)}
            defaultName={defaultName}
            defaultPhone={defaultPhone}
            forceDefault={!list.length}
            onSaved={onSaved}
            onCancel={list.length ? () => setEditing(null) : undefined}
          />
        </div>
      ) : null}
      {list.length ? (
        <div className="cm-ads">
          {list.map((a) => (
            <AddressCard key={a.id} a={a} onEdit={() => setEditing(a.id)} onDelete={() => remove(a)} onDefault={() => makeDefault(a)} />
          ))}
          {!editing ? (
            <button type="button" className="cm-ad-new" onClick={() => setEditing("new")}>
              <Icon name="plus" />
              Add a new address
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
