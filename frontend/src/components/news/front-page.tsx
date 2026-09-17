import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ExternalLink } from "lucide-react";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Panel } from "@/components/satark/page";
import { fmtDate, fmtInt, titleCase } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { byNewest, groupByCategory, isRisk, standfirst } from "./lib";

function SourceLine({ item }: { item: NewsItem }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-2">
      <span className={item.kind === "regulator" ? "font-medium text-violet" : "text-ink-2"}>{item.publisher}</span>
      <span aria-hidden>·</span>
      <span className="font-mono">{fmtDate(item.published)}</span>
      {item.category && (
        <>
          <span aria-hidden>·</span>
          <span className="label-caps border border-rule-strong px-1 py-0.5 text-ink-2">{titleCase(item.category)}</span>
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
  if (!item) {
    return (
      <Panel label="Lead story" className="h-full">
        <p className="text-[13px] text-ink-2">No regulator stories are loaded yet.</p>
      </Panel>
    );
  }
  return (
    <Panel label="Lead story" className="h-full">
      <a href={item.url} target="_blank" rel="noreferrer" className="block hover:text-signal">
        <h2 className="text-[26px] leading-[1.08] text-ink sm:text-[30px]">{item.title}</h2>
      </a>
      <p className="mt-3 line-clamp-4 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{standfirst(item.title, item.summary)}</p>
      <SourceLine item={item} />
    </Panel>
  );
}

function SecondaryStories({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Panel key={item.url} bodyClassName="p-3">
          <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-signal">
            <h3 className="text-[15px] leading-snug text-ink">{item.title}</h3>
          </a>
          <SourceLine item={item} />
        </Panel>
      ))}
    </div>
  );
}

// Amber, not a match-risk band colour: this counts adverse-media categories, not name-match confidence.
const riskConfig = { count: { label: "Risk-tagged stories", color: "var(--amber)" } } satisfies ChartConfig;

function RiskDesk({ groups }: { groups: [string, NewsItem[]][] }) {
  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const chartData = groups.map(([category, items]) => ({ category, label: titleCase(category), count: items.length }));
  return (
    <Panel label="Risk desk" meta={`${fmtInt(total)} tagged`} className="h-full">
      {groups.length === 0 ? (
        <p className="text-[13px] text-ink-2">No risk-tagged stories in the loaded window.</p>
      ) : (
        <>
          <ChartContainer config={riskConfig} className="aspect-auto w-full" style={{ height: Math.max(90, chartData.length * 26) }} role="img"
            aria-label={chartData.map((r) => `${r.label}: ${r.count}`).join("; ")}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 26, top: 0, bottom: 0 }} barSize={12}>
              <CartesianGrid horizontal={false} strokeDasharray="2 3" />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis type="category" dataKey="label" width={108} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="var(--color-count)" radius={1}>
                <LabelList dataKey="count" position="right" className="fill-ink font-mono text-[11px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="mt-3 divide-y divide-rule border-t border-rule">
            {groups.map(([category, items]) => (
              <div key={category} className="py-2.5 first:pt-0">
                <p className="label-caps text-ink-3">{titleCase(category)}</p>
                <ul className="mt-1.5 space-y-2">
                  {items.slice(0, 2).map((item) => (
                    <li key={item.url}>
                      <a href={item.url} target="_blank" rel="noreferrer" className="block text-[13px] leading-snug text-ink line-clamp-2 hover:text-signal">
                        {item.title}
                      </a>
                      <p className="mt-0.5 text-[11px] text-ink-2">
                        <span className={item.kind === "regulator" ? "text-violet" : ""}>{item.publisher}</span> · {fmtDate(item.published)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * The front page: a lead + secondaries in the left column, the risk desk rail on the right.
 * On phones the areas fall back to document order — lead, risk desk, secondaries — per the brief's phone spec;
 * `grid-template-areas` re-places them into the two-column wall from `lg` up regardless of source order.
 */
export function FrontPageGrid({ regulatorItems, riskItems }: { regulatorItems: NewsItem[]; riskItems: NewsItem[] }) {
  const sortedReg = [...regulatorItems].sort(byNewest);
  const lead = sortedReg.find(isRisk) ?? sortedReg[0] ?? null;
  const secondaries = sortedReg.filter((i) => i.url !== lead?.url).slice(0, 3);
  const groups = groupByCategory(riskItems);

  return (
    <div className="grid gap-3 lg:grid-cols-[7fr_5fr] lg:[grid-template-areas:'lead_risk'_'secondary_risk']">
      <div className="lg:[grid-area:lead]"><LeadStory item={lead} /></div>
      <div className="order-2 lg:order-none lg:[grid-area:risk]"><RiskDesk groups={groups} /></div>
      <div className="order-3 lg:order-none lg:[grid-area:secondary]"><SecondaryStories items={secondaries} /></div>
    </div>
  );
}
