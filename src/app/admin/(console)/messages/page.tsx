import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { CONTACT_TOPICS, listMessages, MessageListQuery, messageCounts, type MessageStatus } from "@/server/support/contact";
import { ActionButton, Card, EmptyState, FilterChips, PageHeader, Pagination, Pill, SkeletonPage, StatCard, StatGrid, Toolbar, fmtDate, flatParams, type SearchParamsInput } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Messages" };

const TONE: Record<MessageStatus, "new" | "live" | "ended"> = { NEW: "new", REPLIED: "live", CLOSED: "ended" };
const LABEL: Record<MessageStatus, string> = { NEW: "New", REPLIED: "Replied", CLOSED: "Closed" };

async function Messages({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  await requireAdminPage("/admin/messages");
  const params = flatParams(await searchParams);
  const parsed = MessageListQuery.safeParse(params);
  const q = parsed.success ? parsed.data : MessageListQuery.parse({});
  const [list, c] = await Promise.all([listMessages(q), messageCounts()]);
  return (
    <>
      <StatGrid label="Inbox summary" cols={3}>
        <StatCard label="New" value={c.NEW} sub="Waiting for a reply" href="/admin/messages?status=NEW" tone={c.NEW ? "warn" : undefined} />
        <StatCard label="Replied" value={c.REPLIED} sub="Answered, still open" href="/admin/messages?status=REPLIED" />
        <StatCard label="Closed" value={c.CLOSED} sub="Resolved" href="/admin/messages?status=CLOSED" />
      </StatGrid>
      <Card title="Inbox" sub="Messages from the Contact page. Reply by email or phone, then mark the message Replied or Closed." id="am-messages">
        <FilterChips
          basePath="/admin/messages"
          params={params}
          param="status"
          label="Filter by status"
          options={[{ value: "", label: "All" }, ...(["NEW", "REPLIED", "CLOSED"] as const).map((s) => ({ value: s, label: LABEL[s] }))]}
        />
        <Toolbar
          search={{ placeholder: "Search name, email, phone, order or message…" }}
          filters={[{ param: "topic", label: "Topic", allLabel: "All topics", options: Object.entries(CONTACT_TOPICS).map(([value, label]) => ({ value, label })) }]}
        />
        {list.items.length ? (
          <ul className="am-revs">
            {list.items.map((m) => {
              const st = m.status as MessageStatus;
              const subject = encodeURIComponent(`Re: your message to The Big Brands${m.orderNumber ? ` (order ${m.orderNumber})` : ""}`);
              return (
                <li key={m.id} className={st === "CLOSED" ? "is-off" : undefined}>
                  <div className="am-rev-h">
                    <Pill tone={TONE[st] ?? "ended"}>{LABEL[st] ?? st}</Pill>
                    <b>{m.topicLabel}</b>
                    {m.orderNumber ? (
                      <Link className="am-tag am-tag-violet" href={`/admin/orders/${m.orderNumber}`}>
                        <Icon name="box" />
                        {m.orderNumber}
                      </Link>
                    ) : null}
                  </div>
                  <p className="am-rev-b">{m.message}</p>
                  <div className="am-rev-f">
                    <span>
                      <b>{m.name}</b> · <a className="link" href={`mailto:${m.email}?subject=${subject}`}>{m.email}</a>
                      {m.phone ? (
                        <>
                          {" "}
                          · <a className="link" href={`tel:+91${m.phone}`}>{m.phone}</a>
                        </>
                      ) : null}
                    </span>
                    <span>
                      {fmtDate(m.createdAt)}
                      {m.userId ? (
                        <>
                          {" "}
                          · <Link className="link" href={`/admin/customers/${m.userId}`}>customer profile</Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="am-rev-a">
                    {st !== "REPLIED" ? (
                      <ActionButton url={`/api/v1/admin/messages/${m.id}`} method="PATCH" body={{ status: "REPLIED" }} success="Marked as replied" icon="check">
                        Mark replied
                      </ActionButton>
                    ) : null}
                    {st !== "CLOSED" ? (
                      <ActionButton url={`/api/v1/admin/messages/${m.id}`} method="PATCH" body={{ status: "CLOSED" }} success="Message closed">
                        Close
                      </ActionButton>
                    ) : (
                      <ActionButton url={`/api/v1/admin/messages/${m.id}`} method="PATCH" body={{ status: "NEW" }} success="Message reopened">
                        Reopen
                      </ActionButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="info" title="No messages here">
            Messages sent from the Contact page show up in this inbox.
          </EmptyState>
        )}
        <Pagination basePath="/admin/messages" params={params} page={list.page} pages={list.pages} total={list.total} limit={list.limit} noun="messages" />
      </Card>
    </>
  );
}

export default function MessagesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  return (
    <>
      <PageHeader title="Messages" sub="Customer, brand and seller enquiries from the Contact page." />
      <Suspense fallback={<SkeletonPage stats={3} rows={6} />}>
        <Messages searchParams={searchParams} />
      </Suspense>
    </>
  );
}
