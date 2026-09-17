import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { Band } from "@/lib/types";

const BIN_WIDTH = 5;
const BINS = [70, 75, 80, 85, 90, 95];
const BAND_COLOR: Record<Band, string> = { strong: "var(--band-strong)", probable: "var(--band-probable)", possible: "var(--band-possible)", weak: "var(--ink-3)" };

const config = { count: { label: "Alerts" } } satisfies ChartConfig;

/** Score bins from 70 to 100, coloured by the band the alerts in that bin actually carry, with the 80 alert threshold marked. */
export function ScoreHistogram() {
  const stats = useQuery(q.stats());
  const alerts = useQuery(q.alerts());
  if (stats.error || alerts.error) return <ErrorState error={stats.error ?? alerts.error} what="the score histogram" />;
  if (!stats.data || !alerts.data) return <LoadingBlock rows={5} />;

  const items = alerts.data.items;
  const threshold = stats.data.alert_threshold;
  const data = BINS.map((bin) => {
    const inBin = items.filter((a) => a.score >= bin && a.score < bin + BIN_WIDTH);
    const bandCounts: Record<Band, number> = { strong: 0, probable: 0, possible: 0, weak: 0 };
    for (const a of inBin) bandCounts[a.band] += 1;
    const topBand = (Object.entries(bandCounts) as [Band, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { bin, label: `${bin}`, count: inBin.length, band: topBand };
  });
  const strongCount = items.filter((a) => a.band === "strong").length;
  const probableCount = items.filter((a) => a.band === "probable").length;

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-[190px] w-full" role="img"
        aria-label={`Alert score histogram, 70 to 100. ${data.map((d) => `${d.label}–${d.bin + BIN_WIDTH}: ${d.count}`).join(", ")}. Alert threshold at ${threshold}.`}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} strokeDasharray="2 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--ink-3)", fontSize: 11 }} />
          <YAxis allowDecimals={false} width={26} tickLine={false} axisLine={false} tick={{ fill: "var(--ink-3)", fontSize: 11 }} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value, _n, item) => (
            <span className="flex gap-3"><span className="text-ink-2">score {item.payload.bin}–{item.payload.bin + BIN_WIDTH}</span><span className="font-mono tabular">{String(value)}</span></span>
          )} />} />
          <ReferenceLine x={String(Math.floor(threshold / BIN_WIDTH) * BIN_WIDTH)} stroke="var(--amber)" strokeDasharray="4 3"
            label={{ value: `${threshold} threshold`, position: "insideTopLeft", fill: "var(--amber)", fontSize: 11 }} />
          <Bar dataKey="count" radius={[1, 1, 0, 0]}>
            {data.map((d) => <Cell key={d.bin} fill={d.band ? BAND_COLOR[d.band] : "var(--sunken)"} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
      <Takeaway>
        {fmtInt(strongCount)} alerts land in the strong band (score 90+), {fmtInt(probableCount)} in probable — none score below the {threshold} alert
        threshold, since screening never opens an alert under it.
      </Takeaway>
    </div>
  );
}
