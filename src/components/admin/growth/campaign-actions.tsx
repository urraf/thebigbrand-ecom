"use client";
/**
 * Lifecycle buttons for a campaign → POST /api/v1/admin/campaigns/:id/action
 * approve · reject (reason) · pause · resume · end · duplicate (opens the new draft)
 */
import { ActionButton, ConfirmButton, useAdminAction } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";

type Props = {
  id: string;
  code: string;
  status: string;
  name?: string;
  /** "queue" = big approve/reject pair on review cards; "detail" = full toolbar */
  variant?: "queue" | "detail";
  /** where to go after approving (default: refresh in place) */
  afterApprove?: string;
  /** never delivered / paid → can be deleted (DRAFT, REJECTED, ENDED) */
  deletable?: boolean;
};

export function CampaignActions({ id, code, status, name, variant = "detail", afterApprove, deletable }: Props) {
  const url = `/api/v1/admin/campaigns/${id}/action`;
  const canApprove = ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(status);
  const canReject = ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED"].includes(status);
  const canEnd = ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED"].includes(status);

  const approve = canApprove ? (
    <ConfirmButton
      url={url}
      body={{ action: "approve" }}
      confirm={`Approve ${code}?`}
      message="It goes live in its slot on the website & apps immediately (while the flight is running and the slot is active)."
      confirmLabel="Approve & go live"
      tone="ok"
      success={`${code} approved`}
      redirect={afterApprove}
      className={variant === "queue" ? "btn btn-cart" : "btn btn-cart btn-sm"}
    >
      <Icon name="check" />
      {variant === "queue" ? "Approve & go live" : "Approve"}
    </ConfirmButton>
  ) : null;

  const reject = canReject ? (
    <ConfirmButton
      url={url}
      body={{ action: "reject" }}
      confirm={`Reject ${code}?`}
      message={status === "APPROVED" || status === "PAUSED" ? "The campaign stops serving straight away." : "The advertiser sees your reason and can book again with a fixed creative."}
      confirmLabel="Reject campaign"
      tone="danger"
      reason={{ label: "Reason for the advertiser", field: "reason", required: true, placeholder: "e.g. The image is blurry — please upload a sharper 1500×420 banner" }}
      success={`${code} rejected`}
      className={variant === "queue" ? "btn btn-ghost" : "btn btn-ghost btn-sm"}
    >
      Reject
    </ConfirmButton>
  ) : null;

  if (variant === "queue") {
    return (
      <div className="am-camp-act">
        {approve}
        {reject}
        <a className={variant === "queue" ? "btn btn-ghost" : "btn btn-ghost btn-sm"} href={`/admin/campaigns/${id}`}>
          <Icon name="sliders" />
          Review &amp; edit
        </a>
      </div>
    );
  }

  return (
    <div className="ag-actions">
      {approve}
      {status === "APPROVED" ? (
        <ActionButton url={url} body={{ action: "pause" }} success={`${code} paused — hidden from the storefront`} icon="pause" className="btn btn-ghost btn-sm">
          <Icon name="pause" />
          Pause
        </ActionButton>
      ) : null}
      {status === "PAUSED" ? (
        <ActionButton url={url} body={{ action: "resume" }} success={`${code} resumed`} icon="play" className="btn btn-ghost btn-sm">
          <Icon name="play" />
          Resume
        </ActionButton>
      ) : null}
      {reject}
      {canEnd ? (
        <ConfirmButton
          url={url}
          body={{ action: "end" }}
          confirm={`End ${code} now?`}
          message="It stops serving immediately and can't be restarted (you can duplicate it later)."
          confirmLabel="End campaign"
          tone="danger"
          success={`${code} ended`}
          className="btn btn-ghost btn-sm"
        >
          End
        </ConfirmButton>
      ) : null}
      <DuplicateButton id={id} code={code} name={name} />
      {deletable && ["DRAFT", "REJECTED", "ENDED"].includes(status) ? (
        <ConfirmButton
          url={`/api/v1/admin/campaigns/${id}`}
          method="DELETE"
          confirm={`Delete ${code}?`}
          message="It never delivered or took payment, so it can be removed for good."
          confirmLabel="Delete"
          tone="danger"
          success={`${code} deleted`}
          redirect="/admin/campaigns"
          className="btn btn-ghost btn-sm"
          ariaLabel={`Delete ${code}`}
        >
          <Icon name="trash" />
        </ConfirmButton>
      ) : null}
    </div>
  );
}

export function DuplicateButton({ id, code, name, className = "btn btn-ghost btn-sm" }: { id: string; code: string; name?: string; className?: string }) {
  const { run, busy } = useAdminAction();
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-label={`Duplicate ${name ?? code}`}
      onClick={() =>
        run<{ id: string; code: string }>(
          `/api/v1/admin/campaigns/${id}/action`,
          { method: "POST", body: { action: "duplicate" } },
          { success: (d) => `Draft ${(d as { code: string }).code} created from ${code}`, redirect: (d) => `/admin/campaigns/${(d as { id: string }).id}` },
        )
      }
    >
      <Icon name="layers" />
      {busy ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
