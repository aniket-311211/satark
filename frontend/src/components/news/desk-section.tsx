import { fmtInt, titleCase } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dateline } from "./dateline";
import { byNewest, standfirst } from "./lib";

function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-3">
      <Dateline published={item.published} fetchedAt={item.fetched_at} />
      {item.category && <><span aria-hidden>·</span><span className="text-ink-2">{titleCase(item.category)}</span></>}
    </p>
  );
}

/**
 * One desk as a newspaper section: a lead at display scale with its standfirst, two secondaries a step
 * smaller, then a compact briefs rail. Desks sit side by side, divided by column rules.
 */
function Desk({ name, items, tone }: { name: string; items: NewsItem[]; tone: string }) {
  const sorted = [...items].sort(byNewest);
  const [lead, ...rest] = sorted;
  const secondaries = rest.slice(0, 2);
  const briefs = rest.slice(2, 8);
  return (
    <section className="min-w-0 px-4 py-4 first:pl-0 last:pr-0 max-lg:px-0" aria-label={`${name} desk`}>
      <header className="flex items-baseline justify-between gap-2 border-b-2 border-ink pb-1.5">
        <h3 className={cn("text-[15px] font-bold tracking-wide uppercase [font-stretch:125%]", tone)}>{name}</h3>
        <span className="text-[11.5px] text-ink-3"><span className="font-mono">{fmtInt(items.length)}</span> stories</span>
      </header>
      {!lead ? (
        <p className="mt-3 text-[13px] text-ink-3">Nothing from this desk in the loaded window.</p>
      ) : (
        <>
          <article className="mt-3">
            <a href={lead.url} target="_blank" rel="noreferrer" title={lead.title} className="line-clamp-4 text-[20px] leading-[1.15] font-semibold text-ink [font-stretch:108%] hover:text-signal">
              {lead.title}
            </a>
            {standfirst(lead.title, lead.summary) && (
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{standfirst(lead.title, lead.summary)}</p>
            )}
            <Meta item={lead} />
          </article>
          {secondaries.length > 0 && (
            <div className="mt-3 space-y-3 border-t border-rule pt-3">
              {secondaries.map((item) => (
                <article key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer" title={item.title} className="line-clamp-3 text-[14.5px] leading-snug font-medium text-ink hover:text-signal">{item.title}</a>
                  <Meta item={item} />
                </article>
              ))}
            </div>
          )}
          {briefs.length > 0 && (
            <div className="mt-3 border-t border-rule pt-2">
              <p className="label-caps text-ink-3">In brief</p>
              <ul className="mt-1 divide-y divide-rule/70">
                {briefs.map((item) => (
                  <li key={item.url} className="flex items-baseline gap-2 py-1.5">
                    <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2 hover:text-signal" title={item.title}>{item.title}</a>
                    <span className="shrink-0 text-[11px] text-ink-3"><Dateline published={item.published} fetchedAt={item.fetched_at} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Desks side by side with column rules; on phones they stack. */
export function DeskSection({ desks, tone, columns }: { desks: [string, NewsItem[]][]; tone: string; columns: string }) {
  return (
    <div className={cn("grid border-y border-rule lg:divide-x lg:divide-rule max-lg:divide-y max-lg:divide-rule", columns)}>
      {desks.map(([name, items]) => <Desk key={name} name={name} items={items} tone={tone} />)}
    </div>
  );
}
