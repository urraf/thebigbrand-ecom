import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import "@/styles/admin/admin.css";
import "@/styles/admin/core.css";

export const metadata: Metadata = {
  title: { default: "Admin sign in", template: "%s · TBB Admin" },
  robots: { index: false, follow: false },
};

/** Signed-out admin pages (login): no store chrome, no console shell. */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
