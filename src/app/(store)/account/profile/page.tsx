import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { getProfile } from "@/server/account/profile";
import { ProfileForm } from "@/components/commerce/account/profile-form";
import { AccSkeleton } from "@/components/commerce/account/skeleton";

export const metadata = { title: "Profile & security" };

/** /account/profile — name, email, (read-only) mobile and sign out. */
export default function ProfilePage() {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <ProfileSection />
    </Suspense>
  );
}

async function ProfileSection() {
  const auth = await requireUserPage("/account/profile");
  const profile = await getProfile(auth.user.id);
  return (
    <section className="blk cm-acc-sec">
      <div className="co-sec-h">
        <div>
          <h1 className="cm-h1">Profile &amp; security</h1>
          <p>Keep your name and email up to date for order updates and invoices.</p>
        </div>
      </div>
      <ProfileForm initial={profile} />
    </section>
  );
}
