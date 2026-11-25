"use client";
/** Actions on one of my sponsored campaigns: pay, pause / resume (my own pause only), withdraw (unpaid, in review). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { api, errorText } from "./api";
import { PayPanel } from "./pz-pay-panel";

type Props = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  pausedBySeller: boolean;
  ended: boolean;
  prefill: { name?: string; email?: string; contact?: string };
};

export function CampaignActions({ id, code, status, paymentStatus, pausedBySeller, ended, prefill }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState(false);

  async function act(action: "pause" | "resume" | "withdraw") {
    if (action === "withdraw" && !confirm(`Withdraw ${code}? It won't be reviewed or shown.`)) return;
    setBusy(true);
    try {
      await api(`/api/v1/seller/ads/${id}`, { method: "PATCH", body: { action } });
      toast(action === "pause" ? `${code} paused` : action === "resume" ? `${code} is running again` : `${code} withdrawn`, { icon: action === "pause" ? "pause" : "check" });
      start(() => router.refresh());
    } catch (e) {
      toast(errorText(e), { icon: "info" });
    } finally {
      setBusy(false);
    }
  }

  const unpaid = paymentStatus === "UNPAID" && (status === "PENDING_REVIEW" || status === "APPROVED" || status === "DRAFT") && !ended;

  return (
    <div className="sl-actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
      {unpaid ? <PayPanel compact code={code} payment={null} prefill={prefill} onPaid={() => start(() => router.refresh())} /> : null}
      {status === "APPROVED" && !ended ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("pause")}>
          <Icon name="pause" /> Pause
        </button>
      ) : null}
      {status === "PAUSED" && pausedBySeller && !ended ? (
        <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => act("resume")}>
          <Icon name="play" /> Resume
        </button>
      ) : null}
      {(status === "PENDING_REVIEW" || status === "DRAFT") && paymentStatus !== "PAID" ? (
        <button type="button" className="ib-sm" disabled={busy} onClick={() => act("withdraw")} aria-label={`Withdraw ${code}`} title="Withdraw">
          <Icon name="trash" />
        </button>
      ) : null}
    </div>
  );
}
