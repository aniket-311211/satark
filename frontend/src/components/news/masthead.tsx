import { Radio } from "lucide-react";
import { fmtInt, fmtTime } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { byNewest } from "./lib";

const editionFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap" title={title}>
      <span className="font-mono text-ink">{value}</span>
      <span className="label-caps text-ink-3">{label}</span>
    </span>
  );
}

/** The masthead: wordmark-scale title, edition date, and the live counts a reviewer skims first. */
export function Nameplate({
  articlesIndexed, regulatorCount, riskCount, feedsOk, feedsTotal, lastPoll,
}: {
  articlesIndexed: number;
  regulatorCount: number;
  riskCount: number;
  feedsOk: number;
  feedsTotal: number;
  lastPoll: string | null;
}) {
  return (
    <header className="border-b border-rule-strong pb-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5">
        <h1 className="text-[38px] leading-[0.95] uppercase tracking-[0.01em] text-ink [font-stretch:135%] sm:text-[52px]">
          Satark Wire
        </h1>
        <p className="label-caps pb-1 text-ink-2">{editionFmt.format(new Date())}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-rule pt-2.5">
        <Stat value={fmtInt(articlesIndexed)} label="Articles indexed" title="Total articles across every tracked feed" />
        <Stat value={fmtInt(regulatorCount)} label="Regulator items" />
        <Stat value={fmtInt(riskCount)} label="Risk-tagged" title="Counted across the recent window loaded below, not the full archive" />
        <Stat value={`${feedsOk}/${feedsTotal}`} label="Feeds OK" />
        <Stat value={lastPoll ? fmtTime(lastPoll) : "—"} label="Last poll" />
      </div>
    </header>
  );
}

/** One ticker of the latest regulator headlines: doubled list, `tape-run` pauses on hover and stops under reduced motion. */
export function Ticker({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  const headlines = [...items].sort(byNewest).slice(0, 14);
  return (
    <div className="flex items-stretch overflow-hidden border-y border-rule bg-bar" aria-label="Latest regulator headlines">
      <span className="label-caps z-10 flex shrink-0 items-center gap-1.5 bg-amber px-3 text-bar">
        <Radio className="size-3.5" aria-hidden /> Wire
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="tape-run flex h-full w-max items-center gap-10 py-2 pr-10 pl-4 whitespace-nowrap">
          {[...headlines, ...headlines].map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] text-ink hover:text-signal">
              <span className="font-medium text-violet">{item.publisher}</span>
              <span className="text-ink-3" aria-hidden>·</span>
              <span>{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
