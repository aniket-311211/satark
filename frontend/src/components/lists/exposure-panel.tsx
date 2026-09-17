import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowUpRight, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertStatusBadge, BandBadge, GroupTag, VerdictBadge } from "@/components/satark/badges";
import { EntityRecord } from "@/components/satark/entity-record";
import { EmptyState, ErrorState, LoadingBlock, Panel } from "@/components/satark/page";
import { ScoreMeter } from "@/components/satark/score";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { Exposure } from "@/lib/types";

function Matches({ exposure }: { exposure: Exposure }) {
  const above = exposure.matches.filter((m) => m.above_threshold);
  if (exposure.matches.length === 0) {
    return <EmptyState title="Nobody in the book matches">No customer's name scores 70 or more against this listing or its aliases.</EmptyState>;
  }
  return (
    <>
      <p className="px-3 pt-3 text-[12.5px] text-ink-2">
        <span className="font-mono text-ink">{fmtInt(exposure.matches.length)}</span> {exposure.matches.length === 1 ? "customer scores" : "customers score"} 70 or more;{" "}
        <span className="font-mono text-ink">{fmtInt(above.length)}</span> reach the alert threshold of <span className="font-mono">{exposure.threshold}</span>.
      </p>
      <ul className="mt-2 divide-y divide-rule border-t border-rule">
        {exposure.matches.map((m) => (
          <li key={m.customer.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/customers/${m.customer.id}`} className="min-w-0 truncate text-[13.5px] text-ink hover:text-signal">{m.customer.name}</Link>
              <GroupTag group={m.customer.group} />
            </div>
            <ScoreMeter score={m.score} band={m.band} threshold={exposure.threshold} />
            <div className="flex flex-wrap items-center gap-2">
              <BandBadge band={m.band} />
              <VerdictBadge verdict={m.secondary.verdict} />
              {m.alert ? <AlertStatusBadge status={m.alert.status} /> : <span className="text-xs text-ink-3">{m.above_threshold ? "No alert raised" : "Below the alert threshold"}</span>}
              {m.alert?.case_id && (
                <Link to={`/cases/${m.alert.case_id}`} className="inline-flex items-center gap-1 text-xs text-signal underline underline-offset-4">
                  Case {m.alert.case_id} <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              )}
            </div>
            <p className="text-[12px] text-ink-3">Matched on “{m.listed_as}” · {m.secondary.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A picked listing: the record as the authority published it, then reverse screening, i.e. who in the book it matches. */
export function ExposurePanel({ entityId }: { entityId: string }) {
  const exposure = useQuery({ ...q.exposure(entityId), enabled: !!entityId });
  if (!entityId) {
    return (
      <Panel label="Listing">
        <EmptyState title="Pick a listing">
          Its record opens here, then Satark screens its name and aliases back against the customer book, so you can see who it touches before an alert does.
        </EmptyState>
      </Panel>
    );
  }
  if (exposure.error) return <ErrorState error={exposure.error} what="this listing" />;
  if (!exposure.data) return <Panel label="Listing"><LoadingBlock rows={6} /></Panel>;
  const { entity } = exposure.data;
  return (
    <div className="space-y-3">
      <Panel label="Listing" actions={
        <Button asChild variant="outline" size="sm">
          <Link to={`/screen?${new URLSearchParams({ name: entity.name, kind: entity.schema === "Person" ? "person" : "org" })}`}><ScanSearch aria-hidden /> Screen this name</Link>
        </Button>
      }>
        <EntityRecord entity={entity} />
      </Panel>
      <Panel label="Who in the book matches" meta="Reverse screening" bodyClassName="p-0">
        <Matches exposure={exposure.data} />
      </Panel>
    </div>
  );
}
