import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListTag } from "@/components/satark/badges";
import { ErrorState, LoadingBlock, PageHeader, Panel } from "@/components/satark/page";
import { WatchlistBoard } from "@/components/overview/watchlist-board";
import { q } from "@/lib/api";
import { fmtInt, fmtTime } from "@/lib/format";

const pctOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

export default function Watchlists() {
  const lists = useQuery(q.watchlists());
  const totals = lists.data?.reduce((t, l) => ({ entities: t.entities + l.entities, active: t.active + l.active, historical: t.historical + l.historical }),
    { entities: 0, active: 0, historical: 0 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Watchlists"
        description="Five official lists, ingested from the full OpenSanctions records. Revoked, expired and out-of-office entries stay searchable but never raise alerts."
        actions={
          <Button asChild variant="outline">
            <Link to="/screen"><ScanSearch aria-hidden /> Screen a name</Link>
          </Button>
        }
      />

      {lists.error ? <ErrorState error={lists.error} what="watchlists" /> : !lists.data || !totals ? <LoadingBlock rows={6} /> : (
        <>
          <div className="flex flex-wrap divide-x divide-rule border border-rule bg-panel text-[13px] text-ink-2" role="group" aria-label="List totals">
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Lists</span><span className="font-mono text-ink">{fmtInt(lists.data.length)}</span></div>
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Entries</span><span className="font-mono text-ink">{fmtInt(totals.entities)}</span></div>
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Active</span><span><span className="font-mono text-ink">{fmtInt(totals.active)}</span> raise alerts</span></div>
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Historical</span><span><span className="font-mono text-ink-3">{fmtInt(totals.historical)}</span> {pctOf(totals.historical, totals.entities)} of entries, never alert</span></div>
          </div>

          <Panel label="List board" meta={`${fmtInt(lists.data.length)} authorities`} bodyClassName="p-0">
            <ul className="divide-y divide-rule md:hidden">
              {lists.data.map((l) => (
                <li key={l.key} className="p-3">
                  <div className="flex items-center gap-2"><ListTag source={l.key} /><span className="text-ink">{l.label}</span></div>
                  <p className="mt-1 text-[13px] text-ink-2">{l.authority}</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                    <div><dt className="label-caps text-ink-3">Entries</dt><dd className="font-mono text-ink">{fmtInt(l.entities)}</dd></div>
                    <div><dt className="label-caps text-ink-3">Active</dt><dd className="font-mono text-ink">{fmtInt(l.active)}</dd></div>
                    <div><dt className="label-caps text-ink-3">Historical</dt><dd><span className="font-mono text-ink-3">{fmtInt(l.historical)}</span> <span className="text-xs text-ink-2">{pctOf(l.historical, l.entities)}</span></dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <Table className="tabular">
                <TableHeader>
                  <TableRow className="border-rule hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-ink-2">List</TableHead>
                    <TableHead className="min-w-[12rem] text-xs font-medium text-ink-2">Authority</TableHead>
                    <TableHead className="text-right text-xs font-medium text-ink-2">Entries</TableHead>
                    <TableHead className="text-right text-xs font-medium text-ink-2">Active</TableHead>
                    <TableHead className="text-right text-xs font-medium text-ink-2">Historical</TableHead>
                    <TableHead className="text-xs font-medium text-ink-2">Last ingest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.data.map((l) => (
                    <TableRow key={l.key} className="border-rule">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <ListTag source={l.key} />
                          <span className="whitespace-nowrap text-ink">{l.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[18rem] min-w-[12rem] py-3 whitespace-normal text-ink-2">{l.authority}</TableCell>
                      <TableCell className="py-3 text-right font-mono text-ink">{fmtInt(l.entities)}</TableCell>
                      <TableCell className="py-3 text-right font-mono text-ink">{fmtInt(l.active)}</TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-mono text-ink-3">{fmtInt(l.historical)}</span>
                        <span className="ml-1.5 text-xs text-ink-2">{pctOf(l.historical, l.entities)}</span>
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap text-ink-2">
                        {l.last_run ? (
                          <>
                            <span className="text-ink">{fmtTime(l.last_run.at)}</span> · {l.last_run.mode}
                            <span className="block font-mono text-xs">
                              +{fmtInt(l.last_run.added)} · ~{fmtInt(l.last_run.changed)} · −{fmtInt(l.last_run.removed)}
                            </span>
                          </>
                        ) : "Never ingested"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-rule bg-sunken/50 hover:bg-sunken/50">
                    <TableCell className="py-3 font-medium text-ink" colSpan={2}>All lists</TableCell>
                    <TableCell className="py-3 text-right font-mono font-medium text-ink">{fmtInt(totals.entities)}</TableCell>
                    <TableCell className="py-3 text-right font-mono font-medium text-ink">{fmtInt(totals.active)}</TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="font-mono font-medium text-ink">{fmtInt(totals.historical)}</span>
                      <span className="ml-1.5 text-xs text-ink-2">{pctOf(totals.historical, totals.entities)}</span>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-ink-2">+ added · ~ changed · − removed</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel label="Active vs historical" meta="Full height active, half height historical">
              <WatchlistBoard />
            </Panel>
            <Panel label="Why an entry goes historical">
              <ul className="space-y-3 text-sm text-ink-2">
                <li className="border-l border-rule-strong py-0.5 pl-3">
                  <span className="text-ink">Revoked or expired orders.</span> An NSE entry is historical when every order against it is revoked, or its debarment period has run out.
                </li>
                <li className="border-l border-rule-strong py-0.5 pl-3">
                  <span className="text-ink">Former PEPs.</span> A member of Parliament stays active for 12 months after leaving office, following the FCA's guidance on former politically exposed persons (FG17/6).
                </li>
                <li className="border-l border-rule py-0.5 pl-3">
                  <span className="text-ink">Only active entries alert.</span> Historical entries still show up when you screen a name, labelled as such, so the history stays visible without queueing work.
                </li>
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
