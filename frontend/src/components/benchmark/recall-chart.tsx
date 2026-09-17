import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { titleCase } from "@/lib/format";
import type { EvalReport } from "@/lib/types";

const NEGATIVE_TRANSFORMS = ["random_person", "surname_swap"];

const config = {
  satark: { label: "Satark", color: "var(--signal)" },
  rapidfuzz: { label: "RapidFuzz", color: "var(--ink-3)" },
} satisfies ChartConfig;

const pctLabel = (v: number) => `${Math.round(v * 100)}%`;

/** Recall on the positive synthetic transforms; the two negative controls (random namesakes, surname swaps) are
 *  shown separately below since a high number there means "correctly not flagged", not recall. */
export function RecallChart({ report }: { report: EvalReport }) {
  const satark = report.systems.satark.per_transform;
  const rapidfuzz = report.systems.rapidfuzz.per_transform;
  const data = Object.keys(satark)
    .filter((t) => !NEGATIVE_TRANSFORMS.includes(t))
    .map((t) => ({ code: t, label: titleCase(t), satark: satark[t], rapidfuzz: rapidfuzz[t] ?? 0 }))
    .sort((a, b) => b.satark - a.satark);

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(200, data.length * 44) }} role="img"
        aria-label={data.map((d) => `${d.label}: Satark ${pctLabel(d.satark)}, RapidFuzz ${pctLabel(d.rapidfuzz)}`).join("; ")}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 0 }} barSize={12} barGap={2}>
          <CartesianGrid horizontal={false} strokeDasharray="2 3" />
          <XAxis type="number" domain={[0, 1]} tickFormatter={pctLabel} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => (
            <span className="flex w-full justify-between gap-3">
              <span className="text-ink-2">{config[name as keyof typeof config].label}</span>
              <span className="font-mono tabular text-ink">{pctLabel(Number(value))}</span>
            </span>
          )} />} />
          <ChartLegend content={<ChartLegendContent className="flex-wrap justify-start gap-x-4" />} verticalAlign="top" align="left" />
          <Bar dataKey="satark" fill="var(--color-satark)" radius={2}>
            <LabelList dataKey="satark" position="right" formatter={(v: unknown) => pctLabel(Number(v))} className="fill-ink font-mono text-[11px]" />
          </Bar>
          <Bar dataKey="rapidfuzz" fill="var(--color-rapidfuzz)" radius={2}>
            <LabelList dataKey="rapidfuzz" position="right" formatter={(v: unknown) => pctLabel(Number(v))} className="fill-ink-2 font-mono text-[11px]" />
          </Bar>
        </BarChart>
      </ChartContainer>

      <div className="mt-6">
        <p className="text-sm text-ink">Correctly not flagged (negative controls)</p>
        <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-[13px] text-ink-2 sm:grid-cols-2">
          {NEGATIVE_TRANSFORMS.map((t) => (
            <li key={t} className="flex items-center justify-between gap-3 border-b border-rule py-1.5">
              <span>{titleCase(t)}</span>
              <span className="font-mono tabular text-ink">Satark {pctLabel(satark[t] ?? 0)} · RapidFuzz {pctLabel(rapidfuzz[t] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
