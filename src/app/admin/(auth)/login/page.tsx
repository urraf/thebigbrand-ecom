import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuth, isAdminRole } from "@/lib/auth";
import { AdminLoginForm } from "@/components/admin/shell/login-form";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Sign in" };

/** Already signed in as ADMIN/STAFF → straight to the console. */
async function SignedInRedirect() {
  const auth = await getAuth();
  if (auth && isAdminRole(auth.user.role)) redirect("/admin");
  return null;
}

const DEMO = process.env.NODE_ENV !== "production" ? { email: "admin@thebigbrands.co.in", password: "Admin@12345" } : null;

export default function AdminLoginPage() {
  return (
    <div className="aml">
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <section className="aml-side" aria-hidden="true">
        <span className="logo-mark aml-logo">
          <i>tbb</i>
          <span>
            <b>
              thebigbrands<em>.co.in</em>
            </b>
            <small>Admin console</small>
          </span>
        </span>
        <div className="aml-pitch">
          <h2>Run the whole store from one place.</h2>
          <ul>
            <li>
              <Icon name="chart" />
              <span>
                <b>Revenue at a glance</b>Product sales and ad income, every day
              </span>
            </li>
            <li>
              <Icon name="check" />
              <span>
                <b>Approvals</b>Seller products, brand campaigns and new sellers
              </span>
            </li>
            <li>
              <Icon name="box" />
              <span>
                <b>Orders &amp; shipping</b>Confirm, pack, ship and track every order
              </span>
            </li>
            <li>
              <Icon name="gift" />
              <span>
                <b>Free-gift engine</b>TBB Originals minis, stock and tier rules
              </span>
            </li>
          </ul>
        </div>
        <small className="aml-foot">A Shriram Ventures Initiative</small>
      </section>
      <main className="aml-main">
        <div className="aml-card">
          <span className="aml-ic">
            <Icon name="shield" />
          </span>
          <h1>Admin sign in</h1>
          <p>For The Big Brands team. Sellers sign in at the seller portal.</p>
          <AdminLoginForm demo={DEMO} />
          <div className="aml-links">
            <Link href="/seller/login">Seller portal</Link>
            <span aria-hidden="true">·</span>
            <Link href="/">Back to store</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
