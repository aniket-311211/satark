import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { api, q } from "@/lib/api";
import { fmtInt, fmtTime, titleCase } from "@/lib/format";

/** Compact feed health table with a manual poll: name, kind, country, articles, last polled, status. */
export function Sources() {
  const client = useQueryClient();
  const feeds = useQuery(q.feeds());
  const poll = useMutation({ mutationFn: api.pollNews, onSuccess: () => client.invalidateQueries({ queryKey: ["news"] }) });
  if (feeds.error) return <ErrorState error={feeds.error} what="feed status" />;
  if (!feeds.data) return <LoadingBlock rows={5} />;
  const added = poll.data?.reduce((sum, f) => sum + f.new, 0);
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-[70ch] text-[13px] text-ink-2">
        RSS carries only recent items, so history starts at the first poll. PIB and Business Standard are excluded because they only answer a spoofed browser.
      </p>
      <div className="flex items-center gap-3">
        {poll.isSuccess && <span className="font-mono text-xs text-cleared" role="status">+{fmtInt(added)} new</span>}
        {poll.isError && <span className="text-xs text-strong" role="alert">Poll failed. Is the API running?</span>}
        <Button variant="outline" onClick={() => poll.mutate()} disabled={poll.isPending}>
          <RefreshCw className={poll.isPending ? "animate-spin" : undefined} aria-hidden />
          {poll.isPending ? "Polling feeds…" : "Poll feeds now"}
        </Button>
      </div>
    </div>
    <div className="overflow-x-auto border border-rule bg-panel">
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
              <TableCell className="py-2.5">{f.kind === "regulator" ? <span className="font-medium text-violet">{f.name}</span> : <span className="text-ink">{f.name}</span>}</TableCell>
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
    </div>
  );
}
