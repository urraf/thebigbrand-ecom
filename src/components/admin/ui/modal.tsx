"use client";
/**
 * Modal + Drawer on the native <dialog> element (focus trap, Esc to close, backdrop click to close).
 *
 *   const [open, setOpen] = useState(false);
 *   <Modal open={open} onClose={() => setOpen(false)} title="Reject product" sub="The seller sees the reason"
 *          footer={<><button className="btn btn-ghost" onClick={…}>Cancel</button><button className="btn btn-danger">Reject</button></>}>
 *     …form fields…
 *   </Modal>
 *   <Drawer open={…} onClose={…} title="Edit brand" size="lg">…</Drawer>
 */
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/cx";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** render the body + footer inside a <form> with this submit handler */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** don't close on backdrop click (e.g. while saving) */
  locked?: boolean;
};

function BaseDialog({ open, onClose, title, sub, children, footer, size = "md", onSubmit, locked, variant }: DialogProps & { variant: "modal" | "drawer" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) document.documentElement.style.overflow = "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const content = (
    <>
      <div className="am-dlg-b">{children}</div>
      {footer ? <div className="am-dlg-f">{footer}</div> : null}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={cx("am-dlg", variant === "modal" ? "am-modal" : "am-drawer", size === "lg" && "is-lg", size === "sm" && "is-sm")}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) closeRef.current();
      }}
      aria-labelledby={undefined}
    >
      {open ? (
        <>
          <div className="am-dlg-h">
            <div>
              <h2>{title}</h2>
              {sub ? <p>{sub}</p> : null}
            </div>
            <button type="button" className="am-iconbtn" onClick={() => !locked && onClose()} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          {onSubmit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e);
              }}
              style={{ display: "contents" }}
              noValidate
            >
              {content}
            </form>
          ) : (
            content
          )}
        </>
      ) : null}
    </dialog>
  );
}

export function Modal(props: DialogProps) {
  return <BaseDialog {...props} variant="modal" />;
}

export function Drawer(props: DialogProps) {
  return <BaseDialog {...props} variant="drawer" />;
}
