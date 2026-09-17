import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtInt, listShort } from "@/lib/format";
import type { Watchlist } from "@/lib/types";

const config = {
  active: { label: "Active (raises alerts)", color: "var(--ink)" },
  historical: { label: "Historical (revoked, expired, out of office)", color: "var(--rule-strong)" },
} satisfies ChartConfig;

/**
 * Active vs historical entries per list. "share" normalises each list to 100% so a 146-entry list stays readable next to
 * a 14,435-entry one; the counts ride along in the right-hand labels either way, so size is never hidden.
 */
export function ListComposition({ lists, mode = "share" }: { lists: Watchlist[]; mode?: "share" | "count" }) {
  const data = lists.map((l) => ({
    name: listShort(l.key),
    active: mode === "share" ? (l.entities ? (l.active / l.entities) * 100 : 0) : l.active,
    historical: mode === "share" ? (l.entities ? (l.historical / l.entities) * 100 : 0) : l.historical,
    counts: `${fmtInt(l.active)} / ${fmtInt(l.historical)}`,
    activeN: l.active,
    historicalN: l.historical,
  }));
  const countsByName = Object.fromEntries(data.map((d) => [d.name, d.counts]));
  return (
    <ChartContainer config={config} className="aspect-auto h-[250px] w-full" role="img"
      aria-label={`Active and historical entries: ${lists.map((l) => `${listShort(l.key)} ${fmtInt(l.active)} active, ${fmtInt(l.historical)} historical`).join("; ")}`}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barSize={18}>
        <CartesianGrid horizontal={false} strokeDasharray="2 3" />
        <XAxis type="number" domain={mode === "share" ? [0, 100] : [0, "dataMax"]} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => (mode === "share" ? `${v}%` : fmtInt(v))} />
        <YAxis yAxisId="name" type="category" dataKey="name" width={78} tickLine={false} axisLine={false} />
        <YAxis yAxisId="counts" type="category" dataKey="name" orientation="right" width={104} tickLine={false} axisLine={false}
          tickFormatter={(name: string) => countsByName[name]} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent
          formatter={(value, name, item) => {
            const n = name === "active" ? item.payload.activeN : item.payload.historicalN;
            return (
              <span className="flex w-full justify-between gap-3">
                <span className="text-ink-2">{config[name as keyof typeof config].label}</span>
                <span className="font-mono tabular text-ink">{fmtInt(n)}{mode === "share" && ` · ${Number(value).toFixed(0)}%`}</span>
              </span>
            );
          }} />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4" />} verticalAlign="top" align="left" />
        <Bar yAxisId="name" dataKey="active" stackId="list" fill="var(--color-active)" radius={[3, 0, 0, 3]} />
        <Bar yAxisId="name" dataKey="historical" stackId="list" fill="var(--color-historical)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
