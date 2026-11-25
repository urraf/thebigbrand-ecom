import { Suspense } from "react";
import { requireUserPage } from "@/lib/auth";
import { listAddresses } from "@/server/account/addresses";
import { AddressBook } from "@/components/commerce/account/address-book";
import { AccSkeleton } from "@/components/commerce/account/skeleton";

export const metadata = { title: "Addresses" };

/** /account/addresses — address book (add / edit / delete / set default). */
export default function AddressesPage() {
  return (
    <Suspense fallback={<AccSkeleton />}>
      <Addresses />
    </Suspense>
  );
}

async function Addresses() {
  const auth = await requireUserPage("/account/addresses");
  const list = await listAddresses(auth.user.id);
  return (
    <section className="blk cm-acc-sec">
      <div className="co-sec-h">
        <div>
          <h1 className="cm-h1">Your addresses</h1>
          <p>Your default address is pre-selected at checkout. Indian 6-digit pincodes only.</p>
        </div>
      </div>
      <AddressBook initial={list} defaultName={auth.user.name} defaultPhone={auth.user.phone} />
    </section>
  );
}
