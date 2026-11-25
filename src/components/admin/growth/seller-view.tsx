/**
 * Seller KYC / bank review blocks (server-compatible).
 */
import { avatarTint, fmtDate, initials } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";
import { GIcon } from "./bits";
import { Reveal } from "./seller-controls";

export type KycSeller = {
  businessName: string;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  gstin: string | null;
  pan: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  categories: string[];
  brandsAuthorised: string[];
  description: string | null;
};

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const norm = (s: string) => s.toLowerCase().replace(/(pvt|private|ltd|limited|llp|india|traders|distributors|wholesale|&|and|\.|,)/g, "").replace(/\s+/g, " ").trim();

/** Automatic KYC sanity checks shown to the reviewer (not a substitute for document checks). */
export function kycChecks(s: KycSeller): Array<{ ok: boolean; text: string }> {
  const gst = (s.gstin ?? "").toUpperCase();
  const pan = (s.pan ?? "").toUpperCase();
  const checks = [
    { ok: GSTIN.test(gst), text: gst ? (GSTIN.test(gst) ? "GSTIN format valid" : "GSTIN format looks wrong") : "No GSTIN" },
    { ok: PAN.test(pan), text: pan ? (PAN.test(pan) ? "PAN format valid" : "PAN format looks wrong") : "No PAN" },
  ];
  if (GSTIN.test(gst) && PAN.test(pan)) checks.push({ ok: gst.slice(2, 12) === pan, text: gst.slice(2, 12) === pan ? "PAN matches GSTIN" : "PAN doesn't match the GSTIN" });
  const bankOk = Boolean(s.bankAccountNumber && IFSC.test((s.bankIfsc ?? "").toUpperCase()));
  checks.push({ ok: bankOk || Boolean(s.upiId), text: bankOk ? "Bank account + IFSC on file" : s.upiId ? "UPI only (no bank account)" : "No payout details" });
  if (s.bankAccountName) {
    const same = norm(s.bankAccountName) && (norm(s.businessName).includes(norm(s.bankAccountName)) || norm(s.bankAccountName).includes(norm(s.businessName)));
    checks.push({ ok: Boolean(same), text: same ? "Account holder matches business" : "Account holder differs from business name" });
  }
  return checks;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v || <span className="ag-dash">—</span>}</dd>
    </div>
  );
}

export function KycGrid({ s }: { s: KycSeller }) {
  const acct = s.bankAccountNumber?.replace(/\s/g, "") ?? "";
  return (
    <div className="ag-kyc">
      <section>
        <h4>
          <Icon name="store" />
          Business
        </h4>
        <dl>
          <Row k="Legal name" v={s.businessName} />
          <Row k="Store name" v={s.displayName} />
          <Row k="Contact" v={s.contactName} />
          <Row k="Email" v={<a className="ag-link" href={`mailto:${s.email}`}>{s.email}</a>} />
          <Row k="Mobile" v={s.phone} />
          <Row k="Address" v={[s.addressLine, s.city, s.state, s.pincode].filter(Boolean).join(", ")} />
        </dl>
      </section>
      <section>
        <h4>
          <GIcon name="id" />
          KYC &amp; catalogue
        </h4>
        <dl>
          <Row k="GSTIN" v={s.gstin ? <span className="ag-mono">{s.gstin}</span> : null} />
          <Row k="PAN" v={s.pan ? <span className="ag-mono">{s.pan}</span> : null} />
          <Row
            k="Categories"
            v={
              s.categories.length ? (
                <span className="ag-chips">
                  {s.categories.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </span>
              ) : null
            }
          />
          <Row
            k="Brands"
            v={
              s.brandsAuthorised.length ? (
                <span className="ag-chips">
                  {s.brandsAuthorised.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </span>
              ) : null
            }
          />
          {s.description ? <Row k="About" v={s.description} /> : null}
        </dl>
      </section>
      <section>
        <h4>
          <GIcon name="bank" />
          Bank &amp; payouts
        </h4>
        <dl>
          <Row k="Account name" v={s.bankAccountName} />
          <Row k="Account no." v={acct ? <Reveal value={acct} masked={`•••• •••• ${acct.slice(-4)}`} /> : null} />
          <Row k="IFSC" v={s.bankIfsc ? <span className="ag-mono">{s.bankIfsc}</span> : null} />
          <Row k="UPI" v={s.upiId ? <span className="ag-mono">{s.upiId}</span> : null} />
        </dl>
      </section>
    </div>
  );
}

export function KycChecks({ s }: { s: KycSeller }) {
  return (
    <ul className="ag-checks-k" aria-label="Automatic checks">
      {kycChecks(s).map((c) => (
        <li key={c.text} className={c.ok ? undefined : "no"}>
          <Icon name={c.ok ? "check" : "info"} />
          {c.text}
        </li>
      ))}
    </ul>
  );
}

export function SellerAvatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <span className="ag-app-av" style={{ background: avatarTint(name), width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export const appliedLabel = (d: string) => `Applied ${fmtDate(d)}`;
