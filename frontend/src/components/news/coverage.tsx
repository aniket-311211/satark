import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Panel } from "@/components/satark/page";
import { fmtInt, pct, titleCase } from "@/lib/format";
import type { FeedStatus, NewsItem } from "@/lib/types";

const kindConfig = {
  regulator: { label: "Regulator", color: "var(--violet)" },
  publisher: { label: "Press", color: "var(--signal)" },
} satisfies ChartConfig;

function FeedChart({ feeds }: { feeds: FeedStatus[] }) {
  const data = [...feeds].sort((a, b) => b.articles - a.articles);
  const top = data[0];
  return (
    <>
      <ChartContainer config={kindConfig} className="aspect-auto w-full" style={{ height: Math.max(140, data.length * 24) }} role="img"
        aria-label={data.map((f) => `${f.name} (${kindConfig[f.kind].label}): ${f.articles} articles`).join("; ")}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32, top: 0, bottom: 0 }} barSize={12}>
          <CartesianGrid horizontal={false} strokeDasharray="2 3" />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="articles" radius={1}>
            {data.map((f) => <Cell key={f.name} fill={f.kind === "regulator" ? "var(--color-regulator)" : "var(--color-publisher)"} />)}
            <LabelList dataKey="articles" position="right" className="fill-ink font-mono text-[11px]" formatter={(v: unknown) => fmtInt(Number(v))} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-2 text-[13px] text-ink-2">
        {top?.name} carries the most at {fmtInt(top?.articles ?? 0)} articles, across {data.length} tracked feeds.
      </p>
    </>
  );
}

function ShareChart({ regulatorTotal, pressTotal }: { regulatorTotal: number; pressTotal: number }) {
  const total = regulatorTotal + pressTotal || 1;
  const data = [
    { kind: "publisher" as const, label: "Press", value: pressTotal },
    { kind: "regulator" as const, label: "Regulator", value: regulatorTotal },
  ];
  return (
    <>
      <ChartContainer config={kindConfig} className="aspect-auto h-[90px] w-full" role="img"
        aria-label={`Press ${pressTotal} articles, regulator ${regulatorTotal} articles`}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }} barSize={18}>
          <CartesianGrid horizontal={false} strokeDasharray="2 3" />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="label" width={80} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Bar dataKey="value" radius={1}>
            {data.map((d) => <Cell key={d.kind} fill={`var(--color-${d.kind})`} />)}
            <LabelList dataKey="value" position="right" className="fill-ink font-mono text-[11px]"
              formatter={(v: unknown) => `${fmtInt(Number(v))} (${pct(Number(v) / total)})`} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-2 text-[13px] text-ink-2">
        Press coverage outnumbers regulator orders {pct(pressTotal / total)} to {pct(regulatorTotal / total)} across every tracked feed.
      </p>
    </>
  );
}

function RiskShareChart({ groups }: { groups: [string, NewsItem[]][] }) {
  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const data = groups.map(([category, items]) => ({ category, label: titleCase(category), value: items.length }));
  if (data.length === 0) return <p className="text-[13px] text-ink-2">No risk-tagged stories in the loaded window.</p>;
  const top = data[0];
  return (
    <>
      <ChartContainer config={{ value: { label: "Risk-tagged stories", color: "var(--amber)" } }} className="aspect-auto w-full"
        style={{ height: Math.max(120, data.length * 24) }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join("; ")}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }} barSize={12}>
          <CartesianGrid horizontal={false} strokeDasharray="2 3" />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Bar dataKey="value" fill="var(--color-value)" radius={1}>
            <LabelList dataKey="value" position="right" className="fill-ink font-mono text-[11px]" formatter={(v: unknown) => `${fmtInt(Number(v))} (${pct(Number(v) / total)})`} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="mt-2 text-[13px] text-ink-2">
        {top.label} leads at {pct(top.value / total)} of {fmtInt(total)} risk-tagged stories in the loaded window — not the full archive.
      </p>
    </>
  );
}

/** Coverage analytics: articles per feed, regulator vs press share, and risk-tagged share by category — all real counts. */
export function Coverage({
  feeds, regulatorTotal, pressTotal, riskGroups,
}: {
  feeds: FeedStatus[];
  regulatorTotal: number;
  pressTotal: number;
  riskGroups: [string, NewsItem[]][];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Panel label="Articles per feed"><FeedChart feeds={feeds} /></Panel>
      <Panel label="Regulator vs press"><ShareChart regulatorTotal={regulatorTotal} pressTotal={pressTotal} /></Panel>
      <Panel label="Risk-tagged share"><RiskShareChart groups={riskGroups} /></Panel>
    </div>
  );
}
