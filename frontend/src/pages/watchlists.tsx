import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ErrorState, LoadingBlock, PageHeader } from "@/components/satark/page";
import { ListSelector } from "@/components/lists/list-selector";
import { ListingTable, type ListingFilters } from "@/components/lists/listing-table";
import { ExposurePanel } from "@/components/lists/exposure-panel";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";

const pctOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

export default function Watchlists() {
  const lists = useQuery(q.watchlists());
  const [params, setParams] = useSearchParams();
  const filters: ListingFilters = {
    source: params.get("list") ?? "",
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    kind: params.get("kind") ?? "",
    page: Number(params.get("page") ?? 0) || 0,
  };
  const entity = params.get("entity") ?? "";

  // Every filter lives in the URL, so a listing view can be shared or bookmarked.
  const update = useCallback((next: Partial<ListingFilters & { entity: string }>) => {
    setParams((current) => {
      const merged = new URLSearchParams(current);
      const keys: Record<string, string> = { source: "list", q: "q", status: "status", kind: "kind", page: "page", entity: "entity" };
      for (const [field, value] of Object.entries(next)) {
        const key = keys[field];
        if (value === "" || value === 0 || value === undefined) merged.delete(key);
        else merged.set(key, String(value));
      }
      return merged;
    }, { replace: true });
  }, [setParams]);

  const totals = lists.data?.reduce((t, l) => ({ entities: t.entities + l.entities, active: t.active + l.active, historical: t.historical + l.historical }),
    { entities: 0, active: 0, historical: 0 });

  return (
    <div className="space-y-5">
      <PageHeader brand title="Lists"
        description="Search the listings behind every alert, open a record as the authority published it, and see who in the customer book it matches." />

      {lists.error ? <ErrorState error={lists.error} what="watchlists" /> : !lists.data || !totals ? <LoadingBlock rows={3} /> : (
        <>
          <div className="flex flex-col divide-y divide-rule border border-rule bg-panel text-[13px] text-ink-2 sm:flex-row sm:flex-wrap sm:divide-x sm:divide-y-0" role="group" aria-label="List totals">
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Entries</span><span className="font-mono text-ink">{fmtInt(totals.entities)}</span></div>
            <div className="flex items-baseline gap-2 px-3 py-2"><span className="label-caps text-ink-3">Active</span><span><span className="font-mono text-ink">{fmtInt(totals.active)}</span> raise alerts</span></div>
            <div className="flex items-baseline gap-2 px-3 py-2">
              <span className="label-caps text-ink-3">Historical</span>
              <span title="Revoked or expired orders, and members of Parliament more than 12 months out of office (FCA FG17/6). Still searchable, never alert.">
                <span className="font-mono text-ink-3">{fmtInt(totals.historical)}</span> {pctOf(totals.historical, totals.entities)}: revoked, expired or out of office, never alert
              </span>
            </div>
          </div>
          <ListSelector lists={lists.data} value={filters.source} onChange={(source) => update({ source, page: 0 })} />
        </>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <ListingTable filters={filters} onChange={update} selected={entity} onSelect={(id) => {
          update({ entity: id });
          // stacked layout: the record opens below the list, so bring it into view
          if (!matchMedia("(min-width: 1024px)").matches) requestAnimationFrame(() => document.getElementById("listing-detail")?.scrollIntoView({ block: "start" }));
        }} />
        <div id="listing-detail" className="scroll-mt-16 lg:sticky lg:top-16">
          <ExposurePanel entityId={entity} />
        </div>
      </div>
    </div>
  );
}
