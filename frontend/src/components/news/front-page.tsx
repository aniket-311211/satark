import { ExternalLink } from "lucide-react";
import { Panel } from "@/components/satark/page";
import { fmtInt, titleCase } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { Dateline } from "./dateline";
import { byNewest, groupByCategory, isRisk, standfirst } from "./lib";

function SourceLine({ item }: { item: NewsItem }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-2">
      <span className={item.kind === "regulator" ? "font-medium text-violet" : "text-ink-2"}>{item.publisher}</span>
      <span aria-hidden>·</span>
      <Dateline published={item.published} fetchedAt={item.fetched_at} />
      {item.category && (
        <>
          <span aria-hidden>·</span>
          <span className="label-caps border border-rule-strong px-1 py-0.5 text-ink-2" title="Tagged by keyword rules">{titleCase(item.category)}</span>
        </>
      )}
      <span aria-hidden>·</span>
      <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-signal underline underline-offset-4 hover:decoration-2">
        Source <ExternalLink className="size-3" aria-hidden />
      </a>
    </p>
  );
}

function LeadStory({ item }: { item: NewsItem | null }) {
  if (!item) return <Panel><p className="text-[13px] text-ink-2">No regulator stories are loaded yet.</p></Panel>;
  return (
    <Panel bodyClassName="p-4">
      <a href={item.url} target="_blank" rel="noreferrer" className="block hover:text-signal">
        <h2 className="text-[28px] leading-[1.08] text-ink sm:text-[34px]">{item.title}</h2>
      </a>
      <p className="mt-3 line-clamp-5 max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{standfirst(item.title, item.summary)}</p>
      <SourceLine item={item} />
    </Panel>
  );
}

function SecondaryStories({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid border-y border-rule sm:grid-cols-3 max-sm:divide-y max-sm:divide-rule">
      {items.map((item) => (
        <article key={item.url}
          className="min-w-0 border-rule py-3 sm:border-l sm:px-3 sm:[&:nth-child(3n)]:pr-0 sm:[&:nth-child(3n+1)]:border-l-0 sm:[&:nth-child(3n+1)]:pl-0 sm:[&:nth-child(n+4)]:border-t">
          <a href={item.url} target="_blank" rel="noreferrer" className="block text-[15px] leading-snug font-medium text-ink hover:text-signal">{item.title}</a>
          <p className="mt-1 text-[11.5px] text-ink-3">
            <span className={item.kind === "regulator" ? "text-violet" : ""}>{item.publisher}</span> · <Dateline published={item.published} fetchedAt={item.fetched_at} />
          </p>
        </article>
      ))}
    </div>
  );
}

/** Stories the keyword rules tagged, one line per category with its top story. The rules are heuristics, so the desk says so. */
function RiskDesk({ groups }: { groups: [string, NewsItem[]][] }) {
  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  return (
    <Panel label="Risk desk" meta={`${fmtInt(total)} stories tagged by keyword rules, not read by an analyst`} className="h-full">
      {groups.length === 0 ? (
        <p className="text-[13px] text-ink-2">No keyword-tagged stories in the loaded window.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {groups.map(([category, items]) => {
            const [top] = items;
            return (
              <li key={category} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="label-caps text-amber">{titleCase(category)}</p>
                  <span className="text-[11.5px] text-ink-3"><span className="font-mono text-ink-2">{fmtInt(items.length)}</span> {items.length === 1 ? "story" : "stories"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2" aria-hidden>
                  <div className="h-1 bg-amber" style={{ width: `${(items.length / (groups[0][1].length || 1)) * 100}%` }} />
                </div>
                <a href={top.url} target="_blank" rel="noreferrer" className="mt-1.5 block text-[13.5px] leading-snug text-ink line-clamp-2 hover:text-signal">{top.title}</a>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  <span className={top.kind === "regulator" ? "text-violet" : ""}>{top.publisher}</span> · <Dateline published={top.published} fetchedAt={top.fetched_at} />
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The front page: the lead and a row of secondary stories on the left, the risk desk rail on the right.
 * On phones: lead, risk desk, secondaries.
 */
export function FrontPageGrid({ regulatorItems, riskItems }: { regulatorItems: NewsItem[]; riskItems: NewsItem[] }) {
  const sortedReg = [...regulatorItems].sort(byNewest);
  const lead = sortedReg.find(isRisk) ?? sortedReg[0] ?? null;
  const secondaries = sortedReg.filter((i) => i.url !== lead?.url).slice(0, 6);
  const groups = groupByCategory(riskItems).slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-[7fr_5fr] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <LeadStory item={lead} />
        <div className="order-3 lg:order-none"><SecondaryStories items={secondaries} /></div>
      </div>
      <div className="order-2 lg:order-none"><RiskDesk groups={groups} /></div>
    </div>
  );
}
