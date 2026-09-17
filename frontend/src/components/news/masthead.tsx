import { Radio } from "lucide-react";
import { PageHeader } from "@/components/satark/page";
import { fmtInt, fmtTime } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { byNewest } from "./lib";

const editionFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-3 py-2" title={title}>
      <span className="label-caps text-ink-3">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

/** The masthead: the same branded header every screen uses, the edition date, and the live counts a reviewer skims first. */
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
    <div>
      <PageHeader brand title="Wire"
        description="Regulator orders and business news from ten feeds, read like a front page: what's new, what carries risk, and which names appear in it."
        actions={<p className="label-caps text-ink-2">{editionFmt.format(new Date())}</p>} />
      <div className="flex flex-col divide-y divide-rule border border-rule bg-panel text-[13px] sm:flex-row sm:flex-wrap sm:divide-x sm:divide-y-0" role="group" aria-label="Wire counts">
        <Stat value={fmtInt(articlesIndexed)} label="Articles indexed" title="Total articles across every tracked feed" />
        <Stat value={fmtInt(regulatorCount)} label="Regulator items" />
        <Stat value={fmtInt(riskCount)} label="Risk-tagged" title="Counted across the recent window loaded below, not the full archive" />
        <Stat value={`${feedsOk}/${feedsTotal}`} label="Feeds OK" />
        <Stat value={lastPoll ? fmtTime(lastPoll) : "—"} label="Last poll" />
      </div>
    </div>
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
