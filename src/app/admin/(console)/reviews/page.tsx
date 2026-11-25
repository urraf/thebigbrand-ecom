import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { requireAdminPage } from "@/lib/auth";
import { listReviews, ReviewListQuery, reviewStats } from "@/server/admin/core/reviews";
import { ApiSwitch, Card, ConfirmButton, EmptyState, FilterChips, PageHeader, Pagination, SkeletonPage, StatCard, StatGrid, Toolbar, fmtDate, flatParams, type SearchParamsInput } from "@/components/admin/ui";
import { Stars } from "@/components/ui/stars";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Reviews" };

async function Reviews({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/reviews");
  const params = flatParams(await searchParams);
  const parsed = ReviewListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : ReviewListQuery.parse({});
  const [list, s] = await Promise.all([listReviews(q), reviewStats()]);
  const maxDist = Math.max(1, ...s.dist.map((d) => d.count));
  return (
    <>
      <div className="am-grid">
        <div className="am-span8">
          <StatGrid label="Review summary" cols={3}>
            <StatCard label="Average rating" value={s.avg ? s.avg.toFixed(2) : "—"} unit=" / 5" sub={`${(s.total - s.hidden).toLocaleString("en-IN")} published reviews`} />
            <StatCard label="Hidden" value={s.hidden} sub="Not shown on product pages" href="/admin/reviews?status=hidden" />
            <StatCard label="1–2★ in the last 30 days" value={s.low} sub="Worth a look" href="/admin/reviews?sort=rating&dir=asc&status=published" tone={s.low ? "warn" : undefined} />
          </StatGrid>
        </div>
        <section className="blk am-span4 am-rdist" aria-label="Rating distribution">
          {s.dist.map((d) => (
            <Link key={d.rating} href={`/admin/reviews?rating=${d.rating}`} className="am-rdist-row">
              <span>{d.rating}★</span>
              <span className="am-rdist-bar">
                <i style={{ "--p": (d.count / maxDist).toFixed(3) } as CSSProperties} />
              </span>
              <b className="num">{d.count}</b>
            </Link>
          ))}
        </section>
      </div>
      <Card title="Moderation" sub="Hide a review to take it off the product page (it stays here). Delete removes spam permanently." id="am-reviews">
        <FilterChips
          basePath="/admin/reviews"
          params={params}
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "All" },
            { value: "published", label: "Published" },
            { value: "hidden", label: "Hidden" },
          ]}
        />
        <Toolbar
          search={{ placeholder: "Search text, product, brand or author…" }}
          filters={[
            { param: "rating", label: "Rating", allLabel: "Any rating", options: [5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star${r > 1 ? "s" : ""}` })) },
            { param: "verified", label: "Verified", allLabel: "Verified & unverified", options: [{ value: "yes", label: "Verified buyers" }, { value: "no", label: "Unverified" }] },
            { param: "sort", label: "Sort", allLabel: "Newest first", options: [{ value: "rating", label: "By rating" }, { value: "helpful", label: "Most helpful" }] },
          ]}
        />
        {list.items.length ? (
          <ul className="am-revs">
            {list.items.map((r) => (
              <li key={r.id} className={r.isPublished ? undefined : "is-off"}>
                <div className="am-rev-h">
                  <Stars rating={r.rating} />
                  {r.title ? <b>{r.title}</b> : null}
                  {r.verified ? (
                    <span className="am-tag am-tag-violet">
                      <Icon name="check" />
                      Verified buyer
                    </span>
                  ) : null}
                  {!r.isPublished ? <span className="am-tag">Hidden</span> : null}
                </div>
                <p className="am-rev-b">{r.body}</p>
                <div className="am-rev-f">
                  <span>
                    <b>{r.authorName}</b>
                    {r.city ? `, ${r.city}` : ""} · {fmtDate(r.createdAt)} · {r.helpful} found helpful
                  </span>
                  <span>
                    on{" "}
                    <Link className="link" href={`/admin/products/${r.product.id}`}>
                      {r.product.brand.name} {r.product.name}
                    </Link>
                  </span>
                </div>
                <div className="am-rev-a">
                  <ApiSwitch checked={r.isPublished} url={`/api/v1/admin/reviews/${r.id}`} field="isPublished" label={`Review by ${r.authorName}: ${r.isPublished ? "published" : "hidden"}`} showState onText="Published" offText="Hidden" successOn="Review published" successOff="Review hidden from the product page" />
                  <ConfirmButton url={`/api/v1/admin/reviews/${r.id}`} method="DELETE" className="am-iconbtn is-danger" ariaLabel={`Delete review by ${r.authorName}`} confirm="Delete this review?" message="It's removed permanently. Use Hide if you might want it back." confirmLabel="Delete" tone="danger" success="Review deleted" icon="trash">
                    <Icon name="trash" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="star" title="No reviews match">
            Try another filter.
          </EmptyState>
        )}
        <Pagination basePath="/admin/reviews" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="reviews" />
      </Card>
    </>
  );
}

export default function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Reviews" sub="Moderate what shoppers read on product pages." />
      <Suspense fallback={<SkeletonPage stats={3} />}>
        <Reviews searchParams={searchParams} />
      </Suspense>
    </>
  );
}
