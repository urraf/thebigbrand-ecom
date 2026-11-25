"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/** Console-level error boundary: keeps the sidebar/top bar and offers a retry. */
export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page error", error);
  }, [error]);
  return (
    <div className="blk am-empty" role="alert">
      <Icon name="info" />
      <b>Something went wrong on this page</b>
      <p>The rest of the console still works. Try again, or go back to the dashboard.{error.digest ? ` (ref ${error.digest})` : ""}</p>
      <div className="am-hbtns" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn btn-ghost btn-sm" href="/admin">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
