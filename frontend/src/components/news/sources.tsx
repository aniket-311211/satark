import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { api, q } from "@/lib/api";
import { fmtInt, fmtTime, titleCase } from "@/lib/format";
import type { FeedStatus } from "@/lib/types";

const config = {
  regulator: { label: "Regulator", color: "var(--chart-2)" },
  publisher: { label: "Publisher", color: "var(--chart-1)" },
} satisfies ChartConfig;

function SourcesChart({ feeds }: { feeds: FeedStatus[] }) {
  const data = [...feeds].sort((a, b) => b.articles - a.articles);
  const regulatorTotal = feeds.filter((f) => f.kind === "regulator").reduce((n, f) => n + f.articles, 0);
  const publisherTotal = feeds.filter((f) => f.kind === "publisher").reduce((n, f) => n + f.articles, 0);
  const top = data[0];
  return (
    <>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 28) }} role="img"
        aria-label={data.map((f) => `${f.name} (${config[f.kind].label}): ${f.articles} articles`).join("; ")}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 0 }} barSize={16}>
          <CartesianGrid horizontal={false} strokeDasharray="2 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={148} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value, _n, item) => (
            <span className="flex w-full justify-between gap-3">
              <span className="text-ink-2">{config[item.payload.kind as keyof typeof config].label}</span>
              <span className="font-mono tabular text-ink">{fmtInt(Number(value))}</span>
            </span>
          )} />} />
          <Bar dataKey="articles" radius={3}>
            {data.map((f) => <Cell key={f.name} fill={f.kind === "regulator" ? "var(--color-regulator)" : "var(--color-publisher)"} />)}
            <LabelList dataKey="articles" position="right" className="fill-ink font-mono text-[11px]" formatter={(v: unknown) => fmtInt(Number(v))} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: config.regulator.color }} aria-hidden />Regulator</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: config.publisher.color }} aria-hidden />Publisher</span>
      </div>
      <p className="mt-2 max-w-[72ch] text-[13px] text-ink-2">
        Publisher feeds carry {fmtInt(publisherTotal)} articles against {fmtInt(regulatorTotal)} from regulators
        {top && <>, with {top.name} the largest single source at {fmtInt(top.articles)}</>}: broad business coverage outnumbers primary regulator orders, so the
        subject brief above leans on full-text search across both rather than regulator feeds alone.
      </p>
    </>
  );
}

export function Sources() {
  const feeds = useQuery(q.feeds());
  const client = useQueryClient();
  const poll = useMutation({
    mutationFn: () => api.pollNews(),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news"] }),
  });
  const newItems = poll.data?.reduce((n, f) => n + f.new, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[64ch] text-[13px] text-ink-2">
          RSS feeds carry only recent items, so history accrues from the first poll onward. PIB and Business Standard are excluded because they only answer a
          spoofed browser.
        </p>
        <Button type="button" variant="outline" onClick={() => poll.mutate()} disabled={poll.isPending}>
          {poll.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {poll.isPending ? "Polling…" : "Poll feeds now"}
        </Button>
      </div>
      {poll.isError && <p role="alert" className="mt-2 text-[13px] text-strong">Poll failed: {poll.error instanceof Error ? poll.error.message : String(poll.error)}.</p>}
      {poll.isSuccess && <p className="mt-2 text-[13px] text-ink">{fmtInt(newItems ?? 0)} new article{newItems === 1 ? "" : "s"} across {poll.data!.length} feeds.</p>}

      <div className="mt-4">
        {feeds.error ? <ErrorState error={feeds.error} what="feed status" /> : !feeds.data ? <LoadingBlock rows={5} /> : (
          <>
            <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
              <Table className="tabular">
                <TableHeader>
                  <TableRow className="border-rule hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-ink-2">Feed</TableHead>
                    <TableHead className="text-xs font-medium text-ink-2">Kind</TableHead>
                    <TableHead className="text-xs font-medium text-ink-2">Country</TableHead>
                    <TableHead className="text-right text-xs font-medium text-ink-2">Articles</TableHead>
                    <TableHead className="text-xs font-medium text-ink-2">Last polled</TableHead>
                    <TableHead className="text-xs font-medium text-ink-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeds.data.map((f) => (
                    <TableRow key={f.name} className="border-rule">
                      <TableCell className="py-2.5 text-ink">{f.name}</TableCell>
                      <TableCell className="py-2.5 text-ink-2">{titleCase(f.kind)}</TableCell>
                      <TableCell className="py-2.5 text-ink-2 uppercase">{f.country}</TableCell>
                      <TableCell className="py-2.5 text-right font-mono text-ink">{fmtInt(f.articles)}</TableCell>
                      <TableCell className="py-2.5 whitespace-nowrap text-ink-2">{fmtTime(f.polled_at)}</TableCell>
                      <TableCell className="py-2.5 text-ink-2">{f.status || "never polled"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {feeds.data.some((f) => f.articles > 0) && (
              <div className="mt-6">
                <SourcesChart feeds={feeds.data} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
