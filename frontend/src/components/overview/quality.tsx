import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { EvalReport } from "@/lib/types";

const config = {
  satark: { label: "Satark", color: "var(--signal)" },
  rapidfuzz: { label: "RapidFuzz token_sort_ratio", color: "var(--ink-3)" },
} satisfies ChartConfig;

export function f1At(report: EvalReport, system: "satark" | "rapidfuzz", threshold: number) {
  return report.sweeps[system].find((p) => p.threshold === threshold)?.f1;
}

/** F1 on the held-out test half at every threshold, with the production alert threshold marked. */
export function QualityChart({ report, threshold }: { report: EvalReport; threshold: number }) {
  const rapid = new Map(report.sweeps.rapidfuzz.map((p) => [p.threshold, p.f1]));
  const data = report.sweeps.satark.map((p) => ({ threshold: p.threshold, satark: p.f1, rapidfuzz: rapid.get(p.threshold) ?? null }));
  const s = f1At(report, "satark", threshold);
  const r = f1At(report, "rapidfuzz", threshold);
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full" role="img"
      aria-label={`F1 by threshold. At ${threshold}, Satark ${s?.toFixed(3) ?? "n/a"}, RapidFuzz ${r?.toFixed(3) ?? "n/a"}.`}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 3" />
        <XAxis dataKey="threshold" type="number" domain={[50, 99]} ticks={[50, 60, 70, 80, 90]} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={40} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(2)} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `Threshold ${p?.[0]?.payload?.threshold}`} />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4" />} verticalAlign="top" align="left" />
        <ReferenceLine x={threshold} stroke="var(--ink)" strokeDasharray="4 3"
          label={{ value: `alerts at ${threshold}`, position: "insideBottomLeft", fill: "var(--ink-2)", fontSize: 11 }} />
        <Line dataKey="rapidfuzz" stroke="var(--color-rapidfuzz)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
        <Line dataKey="satark" stroke="var(--color-satark)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
