import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtInt, GROUPS } from "@/lib/format";
import type { Stats } from "@/lib/types";

export interface GroupSieve {
  group: string;
  label: string;
  customers: number;
  alerts: number;
  open: number;
  cleared: number;
  decided: number;
}

export function sieveRows(stats: Stats): GroupSieve[] {
  return Object.keys(GROUPS).map((group) => {
    const rows = stats.alert_outcomes.filter((o) => o.group === group);
    const sum = (pick: (s: string) => boolean) => rows.filter((r) => pick(r.status)).reduce((n, r) => n + r.count, 0);
    return {
      group,
      label: GROUPS[group].label,
      customers: stats.customers_by_group[group] ?? 0,
      alerts: sum(() => true),
      open: sum((s) => s === "open"),
      cleared: sum((s) => s === "auto_cleared"),
      decided: sum((s) => s === "confirmed" || s === "discarded"),
    };
  });
}

const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

/** One sentence, computed from the data, that says what the two charts show. */
export function sieveTakeaway(rows: GroupSieve[]): string {
  const clauses = [...rows]
    .sort((a, b) => b.alerts / (b.customers || 1) - a.alerts / (a.customers || 1))
    .map((r) => {
      const who = `${r.label} records`;
      let clause = r.alerts === 0
        ? `the ${fmtInt(r.customers)} ${who} raised none`
        : `${plural(r.alerts, "alert")} came from ${fmtInt(r.customers)} ${who}`;
      if (r.cleared) clause += `, and identity evidence auto-cleared ${fmtInt(r.cleared)} of them`;
      return clause;
    });
  const text = clauses.length > 1 ? `${clauses.slice(0, -1).join("; ")}; ${clauses.at(-1)}.` : `${clauses[0] ?? "No customers yet"}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const rateConfig = { rate: { label: "Alerts per 100 customers", color: "var(--signal)" } } satisfies ChartConfig;
const outcomeConfig = {
  open: { label: "Open, awaiting review", color: "var(--ink)" },
  cleared: { label: "Auto-cleared by identity evidence", color: "var(--cleared)" },
  decided: { label: "Decided by reviewers", color: "var(--ink-3)" },
} satisfies ChartConfig;

const tick = (rows: GroupSieve[]) => (group: string) => {
  const row = rows.find((r) => r.group === group);
  return row ? `${group} · ${row.label}` : group;
};

/**
 * Rate, not raw count, on the first chart: 840 customers with 0 alerts and 31 with 31 read honestly only per 100.
 * The absolute "x alerts / y customers" label sits on every bar so the rate never hides the size.
 */
export function ScreeningSieve({ rows }: { rows: GroupSieve[] }) {
  const rateData = rows.map((r) => ({ group: r.group, rate: r.customers ? (r.alerts / r.customers) * 100 : 0, label: `${fmtInt(r.alerts)} / ${fmtInt(r.customers)}` }));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm text-ink">Alerts raised per 100 customers</figcaption>
        <ChartContainer config={rateConfig} className="aspect-auto h-[170px] w-full" role="img"
          aria-label={rows.map((r) => `Group ${r.group}, ${r.label}: ${r.alerts} alerts from ${r.customers} customers`).join("; ")}>
          <BarChart data={rateData} layout="vertical" margin={{ left: 0, right: 64, top: 0, bottom: 0 }} barSize={16}>
            <CartesianGrid horizontal={false} strokeDasharray="2 3" />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}`} />
            <YAxis type="category" dataKey="group" width={156} tickLine={false} axisLine={false} tickFormatter={tick(rows)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value, _n, item) => (
              <span className="flex gap-3"><span className="text-ink-2">{item.payload.label} alerts / customers</span><span className="font-mono tabular">{Number(value).toFixed(1)}</span></span>
            )} />} />
            <Bar dataKey="rate" fill="var(--color-rate)" radius={3} minPointSize={2}>
              <LabelList dataKey="label" position="right" className="fill-ink font-mono text-[11px]" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </figure>
      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm text-ink">What happened to those alerts</figcaption>
        <ChartContainer config={outcomeConfig} className="aspect-auto h-[170px] w-full" role="img"
          aria-label={rows.map((r) => `Group ${r.group}: ${r.open} open, ${r.cleared} auto-cleared, ${r.decided} decided`).join("; ")}>
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }} barSize={16}>
            <CartesianGrid horizontal={false} strokeDasharray="2 3" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="group" width={156} tickLine={false} axisLine={false} tickFormatter={tick(rows)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4" />} verticalAlign="bottom" align="left" />
            <Bar dataKey="open" stackId="o" fill="var(--color-open)" />
            <Bar dataKey="cleared" stackId="o" fill="var(--color-cleared)" />
            <Bar dataKey="decided" stackId="o" fill="var(--color-decided)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartContainer>
      </figure>
    </div>
  );
}
