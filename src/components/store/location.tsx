"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import type { DeliverTo } from "@/server/cart/session";
import { useStore } from "@/components/cart/cart-context";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";

const PINCODE = /^[1-9][0-9]{5}$/;
const OPEN_EVENT = "tbb:loc";

/** City for the first three digits of an Indian PIN code (major metros + tier-2 cities; null when unknown). */
const PIN_CITY: Record<string, string> = {
  "110": "New Delhi", "121": "Faridabad", "122": "Gurugram", "201": "Noida", "141": "Ludhiana", "143": "Amritsar",
  "160": "Chandigarh", "208": "Kanpur", "221": "Varanasi", "226": "Lucknow", "248": "Dehradun", "302": "Jaipur",
  "380": "Ahmedabad", "390": "Vadodara", "395": "Surat", "400": "Mumbai", "403": "Goa", "411": "Pune", "440": "Nagpur",
  "452": "Indore", "462": "Bhopal", "500": "Hyderabad", "530": "Visakhapatnam", "560": "Bengaluru", "600": "Chennai",
  "641": "Coimbatore", "682": "Kochi", "695": "Thiruvananthapuram", "700": "Kolkata", "751": "Bhubaneswar",
  "781": "Guwahati", "800": "Patna",
};
export function pincodeCity(pincode: string): string | null {
  return PINCODE.test(pincode) ? (PIN_CITY[pincode.slice(0, 3)] ?? null) : null;
}

/** Opens the deliver-to dialog from anywhere (header button, mobile bar, product pages…). */
export function openLocationDialog() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function useDeliverTo(initial: DeliverTo | null): DeliverTo | null {
  const { deliverTo } = useStore();
  return deliverTo ?? initial;
}

/** Desktop header: "Deliver to Priya / New Delhi 110017" (inside the .hdr-loc button). */
export function DeliverLabel({ initial = null }: { initial?: DeliverTo | null }) {
  const d = useDeliverTo(initial);
  return (
    <span>
      <small>{d?.name ? `Deliver to ${d.name}` : "Deliver to"}</small>
      <b>{d ? `${d.city ? `${d.city} ` : ""}${d.pincode}` : "Enter pincode"}</b>
    </span>
  );
}

/** Mobile location bar text under the header. */
export function LocBarText({ initial = null }: { initial?: DeliverTo | null }) {
  const d = useDeliverTo(initial);
  return (
    <>
      <Icon name="pin" />
      <span>
        {d ? `Delivering to ${d.name ? `${d.name} — ` : ""}${d.city ? `${d.city} ` : ""}${d.pincode}` : "Enter your pincode for delivery dates"} ·{" "}
        <b>FREE delivery over ₹{site.freeShippingMin}</b>
      </span>
    </>
  );
}

/** The deliver-to pincode dialog (native <dialog>: focus trap + Esc for free). Mounted once. */
export function LocationDialog() {
  const { deliverTo, setPincode, user } = useStore();
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const open = () => {
      const d = ref.current;
      if (!d || d.open) return;
      setError(null);
      setPin("");
      d.showModal();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const close = () => ref.current?.close();

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, "");
    if (!PINCODE.test(p)) {
      setError("Enter a valid 6-digit Indian pincode");
      return;
    }
    const city = deliverTo?.pincode === p && deliverTo.city ? deliverTo.city : pincodeCity(p);
    setPincode(p, city);
    close();
    toast(`Delivering to ${city ? `${city} ` : ""}${p} · usually in 2–4 days · FREE over ₹${site.freeShippingMin}`, { icon: "pin" });
  };

  return (
    <dialog ref={ref} className="loc-dlg" aria-labelledby="loc-title" onClick={(e) => e.target === ref.current && close()}>
      <form className="loc-in" onSubmit={apply} noValidate>
        <div className="loc-h">
          <h2 id="loc-title">Choose your delivery location</h2>
          <button type="button" className="ib-sm" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">Delivery dates, COD and free-gift availability depend on your pincode.</p>
        {deliverTo ? (
          <div className="loc-cur">
            <Icon name="pin" />
            <span>
              Currently delivering to{" "}
              <b>
                {deliverTo.city ? `${deliverTo.city} ` : ""}
                {deliverTo.pincode}
              </b>
            </span>
          </div>
        ) : null}
        <label className="loc-field">
          <span>Pincode</span>
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="e.g. 110017"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "loc-err" : undefined}
            autoFocus
          />
        </label>
        {error ? (
          <p id="loc-err" className="loc-err" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-cart loc-go">
          Apply
        </button>
        <p className="loc-note">
          <Icon name="truck" /> We deliver across India · FREE delivery over ₹{site.freeShippingMin} · Cash on delivery available
          {!user ? (
            <>
              {" · "}
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className="link" prefetch={false} onClick={close}>
                Sign in
              </Link>{" "}
              to use your saved addresses
            </>
          ) : null}
        </p>
      </form>
    </dialog>
  );
}
