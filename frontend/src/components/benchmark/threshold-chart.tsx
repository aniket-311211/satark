import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { EvalReport } from "@/lib/types";

type Metric = "f1" | "precision" | "recall";
const METRICS: { value: Metric; label: string }[] = [{ value: "f1", label: "F1" }, { value: "precision", label: "Precision" }, { value: "recall", label: "Recall" }];
const PRODUCTION_THRESHOLD = 80;

const config = {
  exact: { label: "Exact match", color: "var(--chart-3)" },
  rapidfuzz: { label: "RapidFuzz", color: "var(--ink-3)" },
  satark: { label: "Satark", color: "var(--signal)" },
} satisfies ChartConfig;

const at = (report: EvalReport, system: keyof EvalReport["sweeps"], threshold: number, metric: Metric) =>
  report.sweeps[system].find((p) => p.threshold === threshold)?.[metric];

/** Exact match only ever scores 0 or 100, so its report.sweeps entry is a single point at its own threshold (100) —
 *  nothing to plot inside the 50-99 window. Its fixed operating-point metric stands in for that instead. */
function takeaway(report: EvalReport, metric: Metric): string {
  const found = METRICS.find((m) => m.value === metric)!.label;
  const label = metric === "f1" ? "F1" : found.toLowerCase();
  const s = at(report, "satark", PRODUCTION_THRESHOLD, metric);
  const r = at(report, "rapidfuzz", PRODUCTION_THRESHOLD, metric);
  if (s === undefined || r === undefined) return `No sweep data at threshold ${PRODUCTION_THRESHOLD}.`;
  const exact = report.systems.exact;
  return `At the production threshold of ${PRODUCTION_THRESHOLD}, Satark's ${label} is ${s.toFixed(3)} against RapidFuzz's ${r.toFixed(3)}. Exact match only ever scores 0 or 100, ` +
    `so it doesn't vary across this range: fixed at its own threshold of ${exact.threshold}, its ${label} is ${exact[metric].toFixed(3)}.`;
}

export function ThresholdSweepChart({ report }: { report: EvalReport }) {
  const [metric, setMetric] = useState<Metric>("f1");
  const thresholds = report.sweeps.satark.map((p) => p.threshold);
  const data = thresholds.map((threshold) => ({
    threshold,
    exact: at(report, "exact", threshold, metric) ?? null,
    rapidfuzz: at(report, "rapidfuzz", threshold, metric) ?? null,
    satark: at(report, "satark", threshold, metric) ?? null,
  }));

  return (
    <div>
      <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} variant="outline" size="sm" aria-label="Metric to plot">
        {METRICS.map((m) => <ToggleGroupItem key={m.value} value={m.value}>{m.label}</ToggleGroupItem>)}
      </ToggleGroup>
      <ChartContainer config={config} className="mt-3 aspect-auto h-[260px] w-full" role="img"
        aria-label={`${METRICS.find((m) => m.value === metric)!.label} by threshold from 50 to 99, three systems. ${takeaway(report, metric)}`}>
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 3" />
          <XAxis dataKey="threshold" type="number" domain={[50, 99]} ticks={[50, 60, 70, 80, 90, 99]} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={40} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(2)} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `Threshold ${p?.[0]?.payload?.threshold}`} />} />
          <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4" />} verticalAlign="top" align="left" />
          <ReferenceLine x={PRODUCTION_THRESHOLD} stroke="var(--ink)" strokeDasharray="4 3"
            label={{ value: "production threshold", position: "insideBottomLeft", fill: "var(--ink-2)", fontSize: 11 }} />
          <Line dataKey="exact" stroke="var(--color-exact)" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
          <Line dataKey="rapidfuzz" stroke="var(--color-rapidfuzz)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          <Line dataKey="satark" stroke="var(--color-satark)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
      <p className="mt-2 text-[13px] text-ink-2">{takeaway(report, metric)}</p>
    </div>
  );
}
