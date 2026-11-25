import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { discountPct, formatINR } from "@/lib/money";
import { listApprovals } from "@/server/admin/core/products";
import { ActionButton, Card, ConfirmButton, EmptyState, PageHeader, SkeletonTable, StatCard, StatGrid, fmtAgo, fmtDateTime } from "@/components/admin/ui";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ProductImage } from "@/components/ui/product-image";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Product approvals" };

async function Approvals() {
  await requireAdminPage("/admin/approvals");
  const { pending, recent } = await listApprovals();
  const now = new Date().toISOString();
  const approved7 = recent.filter((r) => r.action === "product.approve").length;
  const sellers = new Set(pending.map((p) => p.seller?.id).filter(Boolean)).size;

  return (
    <>
      <StatGrid label="Approval summary">
        <StatCard label="Waiting for review" value={pending.length} sub={pending.length ? `from ${sellers} seller${sellers === 1 ? "" : "s"}` : "All caught up"} tone={pending.length ? "cta" : undefined} />
        <StatCard label="Oldest submission" value={pending[0] ? fmtAgo(pending[0].updatedAt, now).replace(" ago", "") : "—"} sub={pending[0] ? `submitted ${fmtDateTime(pending[0].updatedAt)}` : "No queue"} />
        <StatCard label="Recently approved" value={approved7} sub="in the last 12 decisions" />
        <StatCard label="Sellers" value="Manage" sub="Applications & KYC" href="/admin/sellers" />
      </StatGrid>

      <section className="am-sec" aria-labelledby="am-q-h">
        <div className="am-sec-h">
          <h2 id="am-q-h">Approval queue</h2>
          <span className="am-count">{pending.length}</span>
          <p>Sellers submit products from the seller portal. Approve to put them live on the store instantly, or reject with a reason the seller can act on.</p>
        </div>
        {pending.length ? (
          <div className="am-apq">
            {pending.map((p) => {
              const off = discountPct(p.mrp, p.price);
              return (
                <article className="blk am-apr" key={p.id}>
                  <div className="am-apr-media">
                    <ProductImage className="am-apr-img" sizes="220px" product={{ name: p.name, image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt, width: null, height: null } : null, art: p.art, isOwnLabel: p.isOwnLabel, brand: p.brand }} />
                    {p.images.length > 1 ? (
                      <div className="am-apr-thumbs">
                        {p.images.slice(1, 5).map((img) => (
                          // eslint-disable-next-line @next/next/no-img-element -- seller uploads of unknown size
                          <img key={img.url} src={img.url} alt={img.alt ?? ""} loading="lazy" />
                        ))}
                      </div>
                    ) : null}
                    <small className="am-muted">{p.images.length ? `${p.images.length} photo${p.images.length > 1 ? "s" : ""}` : "No photos — packshot shown"}</small>
                  </div>
                  <div className="am-apr-info">
                    <div className="am-camp-meta">
                      <span className="am-pill am-pill-pending">
                        <i />
                        Awaiting approval
                      </span>
                      <span>submitted {fmtAgo(p.updatedAt, now)}</span>
                    </div>
                    <div className="am-apr-brand">
                      <BrandLogo brand={p.brand} size={15} showSub={false} />
                      <span className="am-muted">· {p.category.name}</span>
                    </div>
                    <h3>{p.name}</h3>
                    <dl className="am-dl">
                      <div>
                        <dt>Seller</dt>
                        <dd>
                          {p.seller ? (
                            <Link className="link" href={`/admin/sellers?q=${encodeURIComponent(p.seller.displayName)}`}>
                              {p.seller.displayName}
                            </Link>
                          ) : (
                            "The Big Brands Retail"
                          )}
                          {p.seller ? <small>{p.seller.commissionPct}% commission</small> : null}
                        </dd>
                      </div>
                      <div>
                        <dt>Price</dt>
                        <dd>
                          <b>{formatINR(p.price)}</b>
                          {off ? (
                            <small>
                              MRP {formatINR(p.mrp)} · {off}% off
                            </small>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt>Stock</dt>
                        <dd>
                          {p.stock} units{p.size ? <small>· {p.size}</small> : null}
                        </dd>
                      </div>
                      <div>
                        <dt>SKU</dt>
                        <dd>{p.sku ?? <span className="am-muted">none</span>}</dd>
                      </div>
                    </dl>
                    {p.description ? <p className="am-apr-desc">{p.description.length > 260 ? p.description.slice(0, 260) + "…" : p.description}</p> : null}
                    <ul className="am-checks">
                      {p.brandAuthorised ? (
                        <li>
                          <Icon name="check" />
                          Seller is authorised for {p.brand.name}
                        </li>
                      ) : (
                        <li className="am-warn">
                          <Icon name="info" />
                          {p.brand.name} isn&apos;t on this seller&apos;s authorised brands
                        </li>
                      )}
                      {p.images.length ? (
                        <li>
                          <Icon name="check" />
                          Has product photos
                        </li>
                      ) : (
                        <li className="am-warn">
                          <Icon name="info" />
                          No photos
                        </li>
                      )}
                      {p.price <= p.mrp ? (
                        <li>
                          <Icon name="check" />
                          Price within MRP
                        </li>
                      ) : null}
                      {p.seller && p.seller.status !== "APPROVED" ? (
                        <li className="am-warn">
                          <Icon name="info" />
                          Seller account is {p.seller.status.toLowerCase()}
                        </li>
                      ) : null}
                    </ul>
                    <div className="am-camp-act">
                      <ActionButton url={`/api/v1/admin/approvals/${p.id}`} body={{ action: "approve" }} className="btn btn-cart" success={`Approved — ${p.name} is live on the store`} icon="check">
                        <Icon name="check" />
                        Approve &amp; go live
                      </ActionButton>
                      <ConfirmButton
                        url={`/api/v1/admin/approvals/${p.id}`}
                        body={{ action: "reject" }}
                        className="btn btn-ghost"
                        confirm={`Reject “${p.name}”?`}
                        message="The seller sees your reason in their portal and can fix and resubmit."
                        confirmLabel="Reject product"
                        tone="danger"
                        reason={{ label: "What should the seller fix?", field: "reason", required: true, minLength: 5, placeholder: "Photos are blurry / MRP doesn't match the pack…" }}
                        success="Product rejected — the seller will see your reason"
                        icon="close"
                      >
                        Reject
                      </ConfirmButton>
                      <Link className="btn btn-ghost" href={`/admin/products/${p.id}`}>
                        Edit details
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="blk">
            <EmptyState icon="check" ok title="All caught up">
              No products are waiting. New submissions from sellers land here for approval.
            </EmptyState>
          </div>
        )}
      </section>

      <Card title="Recent decisions" sub="Last 12 approvals and rejections" id="am-recent">
        {recent.length ? (
          <ul className="am-ls">
            {recent.map((r) => (
              <li key={r.id}>
                {r.productId ? <Link href={`/admin/products/${r.productId}`}>{r.data.name ?? "Product"}</Link> : <span>{r.data.name}</span>}
                <span className="am-ls-v">
                  <span className={`am-pill am-pill-${r.action === "product.approve" ? "live" : "rejected"}`}>
                    <i />
                    {r.action === "product.approve" ? "Approved" : "Rejected"}
                  </span>
                </span>
                <small>
                  {r.data.seller ? `${r.data.seller} · ` : ""}
                  {r.actor} · {fmtDateTime(r.createdAt)}
                  {r.data.reason ? ` · “${r.data.reason}”` : ""}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="am-muted">No decisions yet.</p>
        )}
      </Card>
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader title="Product approvals" sub="Seller-submitted products wait here until you approve them." />
      <Suspense fallback={<SkeletonTable rows={6} />}>
        <Approvals />
      </Suspense>
    </>
  );
}
