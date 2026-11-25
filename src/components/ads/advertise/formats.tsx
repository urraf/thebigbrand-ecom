"use client";
import { useState } from "react";
import type { AdSlotCard } from "@/server/ads/slots";
import { Icon } from "@/components/ui/icon";
import { MODEL_SHORT } from "../lib/pricing";
import { Schematic } from "./schematic";
import { avEmit, fmt, GROUPS, grpOf, HOT, nf, salesMail } from "./shared";

type Fest = { name: string; dates: string; startsIn: number };

function FormatCard({ s }: { s: AdSlotCard }) {
  const hot = HOT[s.code];
  const sold = s.exclusive && s.fill >= 1;
  const fillPct = Math.round(s.fill * 100);
  const label = !s.isActive
    ? "Paused right now"
    : !s.exclusive
      ? s.live
        ? `${s.live} campaign${s.live > 1 ? "s" : ""} running · rotates by budget`
        : "Open — be the first advertiser"
      : sold
        ? "All positions live now · book ahead"
        : `${s.live} of ${s.positions} position${s.positions > 1 ? "s" : ""} live now`;
  return (
    <article className="av-fc">
      <div className="av-fc-sx">
        <Schematic code={s.code} />
      </div>
      <div className="av-fc-body">
        <div className="av-fc-top">
          <span className="av-id">{s.code}</span>
          {s.bookable ? (
            <span className="av-tag av-tag-ss">
              <Icon name="zap" />
              Self-serve
            </span>
          ) : (
            <span className="av-tag av-tag-mg">Managed</span>
          )}
          {hot ? (
            <span className="av-hot">
              <Icon name="star" />
              {hot}
            </span>
          ) : null}
        </div>
        <h4>{s.name}</h4>
        <p>{s.format}</p>
        <dl className="av-fc-meta">
          <div>
            <dt>Size</dt>
            <dd>{s.size}</dd>
          </div>
          <div>
            <dt>Pricing</dt>
            <dd>{MODEL_SHORT[s.pricingModel] ?? s.pricingModel}</dd>
          </div>
          <div>
            <dt>Reach</dt>
            <dd>
              ~{nf(s.reach.imp)}
              <small>/day</small>
            </dd>
          </div>
        </dl>
        <div className={sold ? "av-fill sold" : "av-fill"} title={label}>
          <i style={{ width: `${Math.min(100, fillPct)}%` }} />
          <span>{label}</span>
        </div>
        <div className="av-fc-foot">
          <b className="av-fc-rate">{s.rateLabel}</b>
          <span className="av-fc-btns">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => avEmit({ type: "estimate", slot: s.code })} aria-label={`Estimate ${s.name}`}>
              Estimate
            </button>
            {s.bookable ? (
              <button type="button" className="btn btn-dark btn-sm" onClick={() => avEmit({ type: "pick", slot: s.code })} aria-label={`Book ${s.name}`}>
                Book
              </button>
            ) : (
              <a className="btn btn-ghost btn-sm" href={salesMail(`${s.code} · ${s.name} — enquiry`)} aria-label={`Contact sales about ${s.name}`}>
                Contact
              </a>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Ad formats gallery (demo formats()): filter chips by page, one card per AdSlot with a mini schematic. */
export function FormatsGallery({ slots, fest, takeover }: { slots: AdSlotCard[]; fest: Fest[]; takeover: number }) {
  const [filter, setFilter] = useState("all");
  const by = (id: string) => slots.filter((s) => grpOf(s.page) === id);
  const chips: [string, string, number][] = [["all", "All formats", slots.length], ...GROUPS.map((g) => [g.id, g.name, by(g.id).length] as [string, string, number]).filter((c) => c[2] > 0)];
  return (
    <>
      <div className="av-filter" role="group" aria-label="Filter ad formats by page">
        {chips.map(([id, l, n]) => (
          <button key={id} type="button" className={filter === id ? "chip on" : "chip"} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {l}
            <span>{n}</span>
          </button>
        ))}
      </div>
      <div className="av-groups" data-f={filter}>
        {GROUPS.map((g) => {
          const list = by(g.id);
          if (!list.length) return null;
          const n = list.length;
          const pitch = g.id === "home" && n % 4 !== 0;
          return (
            <div key={g.id} className="av-grp" data-grp={g.id} data-n={Math.min(4, n + (pitch ? 1 : 0))} hidden={filter !== "all" && filter !== g.id}>
              <div className="av-grp-h">
                <span className="av-grp-ic">
                  <Icon name={g.ic} />
                </span>
                <div>
                  <h3>
                    {g.name}
                    <small>
                      {n} placement{n > 1 ? "s" : ""}
                    </small>
                  </h3>
                  <p>{g.desc}</p>
                </div>
              </div>
              <div className="av-cards">
                {list.map((s) => (
                  <FormatCard key={s.code} s={s} />
                ))}
                {pitch ? (
                  <article className="av-fc av-fc-pitch">
                    <span className="av-w-ic">
                      <Icon name="sparkle" />
                    </span>
                    <h4>Homepage takeover</h4>
                    <p>Own the Hero Billboard, Spotlight cards, Leaderboard and Deal of the Day for one big launch day.</p>
                    <b className="av-fc-rate">from {fmt(takeover)}/day</b>
                    <a className="btn btn-light btn-sm" href={salesMail("Homepage takeover — enquiry")}>
                      Talk to partnerships <Icon name="arrow" />
                    </a>
                  </article>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="av-grp av-grp-cta" data-n="2" hidden={filter !== "all"}>
          <div className="av-cta-card">
            <div>
              <span className="av-eyebrow">Custom campaigns</span>
              <h3>Planning a festive sale or a big launch?</h3>
              <p>Bundle any placements into one plan: a single GST invoice, reserved dates and a dedicated campaign manager.</p>
            </div>
            {fest.length ? (
              <div className="av-fest" aria-label="Upcoming festive ad windows">
                <span className="av-fest-h">
                  <Icon name="calendar" />
                  Upcoming sale windows · premium inventory
                </span>
                <ul>
                  {fest.map((w) => (
                    <li key={w.name} className={w.startsIn <= 14 ? "hot" : undefined}>
                      <b>{w.name}</b>
                      <small>{w.dates}</small>
                      <span className="av-fest-bar">
                        <i style={{ width: `${Math.max(6, 100 - Math.min(100, w.startsIn))}%` }} />
                      </span>
                      <em>{w.startsIn <= 0 ? "On now" : `Starts in ${w.startsIn} day${w.startsIn > 1 ? "s" : ""}`}</em>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="av-cta-b">
              <a className="btn btn-cart" href={salesMail("Festive / launch campaign plan")}>
                Plan with our team <Icon name="arrow" />
              </a>
              <button type="button" className="btn av-btn-o" onClick={() => avEmit({ type: "jump", target: "av-est" })}>
                <Icon name="sliders" />
                Try the estimator
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
