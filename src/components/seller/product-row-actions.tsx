"use client";
/** Row actions on the products list: edit, submit for review, archive / restore, delete. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, errorText } from "./api";
import { SLink } from "./link";

type Props = { id: string; name: string; status: string; canDelete: boolean };

export function ProductRowActions({ id, name, status, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function act(action: "archive" | "restore" | "submit") {
    if (action === "archive" && !confirm(`Archive “${name}”? It will be hidden from the store until you restore it.`)) return;
    setBusy(true);
    try {
      await api(`/api/v1/seller/products/${id}/status`, { body: { action } });
      toast(action === "archive" ? "Archived — hidden from the store" : action === "restore" ? "Restored and sent for review" : "Sent for review", { icon: "check" });
      start(() => router.refresh());
    } catch (e) {
      toast(errorText(e), { icon: "info" });
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`Delete “${name}” permanently? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/v1/seller/products/${id}`, { method: "DELETE" });
      toast("Product deleted", { icon: "trash" });
      start(() => router.refresh());
    } catch (e) {
      toast(errorText(e), { icon: "info" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sl-actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
      {status !== "ARCHIVED" ? (
        <SLink href={`/seller/products/${id}`} className="btn btn-ghost btn-sm" aria-label={`Edit ${name}`}>
          Edit
        </SLink>
      ) : null}
      {status === "DRAFT" || status === "REJECTED" ? (
        <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => act("submit")}>
          Submit
        </button>
      ) : null}
      {status === "ARCHIVED" ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("restore")}>
          <Icon name="ret" /> Restore
        </button>
      ) : (
        <button type="button" className="ib-sm" disabled={busy} onClick={() => act("archive")} aria-label={`Archive ${name}`} title="Archive">
          <Icon name="eyeOff" />
        </button>
      )}
      {canDelete ? (
        <button type="button" className="ib-sm" disabled={busy} onClick={del} aria-label={`Delete ${name}`} title="Delete">
          <Icon name="trash" />
        </button>
      ) : null}
    </div>
  );
}
