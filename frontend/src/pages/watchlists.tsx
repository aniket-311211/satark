import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListTag } from "@/components/satark/badges";
import { ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { ListComposition } from "@/components/overview/list-composition";
import { q } from "@/lib/api";
import { fmtInt, fmtTime } from "@/lib/format";

const pctOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

export default function Watchlists() {
  const lists = useQuery(q.watchlists());
  const totals = lists.data?.reduce((t, l) => ({ entities: t.entities + l.entities, active: t.active + l.active, historical: t.historical + l.historical }),
    { entities: 0, active: 0, historical: 0 });

  return (
    <div className="space-y-10">
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
          <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
            <Table className="tabular">
              <TableHeader>
                <TableRow className="border-rule hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-ink-2">List</TableHead>
                  <TableHead className="text-xs font-medium text-ink-2">Authority</TableHead>
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
                      <span className="font-mono text-ink">{fmtInt(l.historical)}</span>
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

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Section title="Active and historical entries" description="Absolute counts per list; labels read active / historical.">
              <ListComposition lists={lists.data} mode="count" />
              <p className="mt-2 text-[13px] text-ink-2">
                {pctOf(totals.historical, totals.entities)} of all {fmtInt(totals.entities)} entries are historical, almost all of them revoked NSE
                debarments and former members of Parliament.
              </p>
            </Section>
            <Section title="How an entry becomes historical">
              <ul className="space-y-3 text-sm text-ink-2">
                <li><span className="text-ink">Revoked or expired orders.</span> An NSE entry is historical when every order against it is revoked, or its debarment period has run out.</li>
                <li><span className="text-ink">Former PEPs.</span> A member of Parliament stays active for 12 months after leaving office, following the FCA's guidance on former politically exposed persons (FG17/6).</li>
                <li><span className="text-ink">Only active entries alert.</span> Historical entries still show up when you screen a name, labelled as such, so the history stays visible without queueing work.</li>
              </ul>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
