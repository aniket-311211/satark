import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListTag } from "@/components/satark/badges";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/satark/page";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { EntityRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 50;

export interface ListingFilters {
  source: string;
  q: string;
  status: string;
  kind: string;
  page: number;
}

function Pills({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-ink-2">{label}</span>
      {options.map(([v, text]) => (
        <button key={v || "all"} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={cn("h-7 cursor-pointer rounded-sm border px-2.5 text-xs transition-colors duration-150",
            value === v ? "border-amber bg-amber-soft text-amber" : "border-rule bg-panel text-ink-2 hover:border-rule-strong hover:text-ink")}>
          {text}
        </button>
      ))}
    </div>
  );
}

function StatusMark({ status }: { status: EntityRow["status"] }) {
  // line form: an active listing is a full-height rule, a historical one half height
  return (
    <span className={cn("inline-flex items-end gap-1.5 text-[12.5px]", status === "active" ? "text-ink" : "text-ink-3")}>
      <span aria-hidden className={cn("w-0.5", status === "active" ? "h-3.5 bg-strong" : "h-1.5 bg-ink-3")} />
      {status === "active" ? "Active" : "Historical"}
    </span>
  );
}

/** Server-driven listing browser: search by name, filter by status and kind, page through, pick a listing to inspect. */
export function ListingTable({ filters, onChange, selected, onSelect }: {
  filters: ListingFilters;
  onChange: (next: Partial<ListingFilters>) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [term, setTerm] = useState(filters.q);
  useEffect(() => setTerm(filters.q), [filters.q]);
  useEffect(() => {
    const t = setTimeout(() => { if (term !== filters.q) onChange({ q: term, page: 0 }); }, 300);
    return () => clearTimeout(t);
  }, [term, filters.q, onChange]);

  const listings = useQuery(q.entities({ q: filters.q, source: filters.source, status: filters.status, kind: filters.kind, offset: filters.page * PAGE }));
  const total = listings.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Find a listing by name</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find a listing by name" className="h-8 rounded-sm border-rule bg-panel pl-9" />
        </label>
        <Pills label="Status" value={filters.status} onChange={(status) => onChange({ status, page: 0 })}
          options={[["", "All"], ["active", "Active"], ["historical", "Historical"]]} />
        <Pills label="Kind" value={filters.kind} onChange={(kind) => onChange({ kind, page: 0 })}
          options={[["", "All"], ["person", "Person"], ["org", "Organisation"]]} />
      </div>

      {listings.error ? <ErrorState error={listings.error} what="listings" /> : !listings.data ? <LoadingBlock rows={8} /> : (
        <>
          <p className="mb-2 text-[12.5px] text-ink-3" aria-live="polite">
            <span className="font-mono text-ink-2">{fmtInt(total)}</span> {total === 1 ? "listing" : "listings"}
            {filters.q && <> matching “{filters.q}”</>}
          </p>
          {listings.data.items.length === 0 ? (
            <div className="border border-rule bg-panel"><EmptyState title="No listings match">Clear the search or pick another list.</EmptyState></div>
          ) : (
            <ul className={cn("divide-y divide-rule border border-rule bg-panel transition-opacity duration-150", listings.isFetching && "opacity-70")}>
              {listings.data.items.map((e) => {
                const Icon = e.schema === "Person" ? User : Building2;
                const active = e.id === selected;
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => onSelect(e.id)} aria-current={active || undefined}
                      className={cn("grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-sunken sm:grid-cols-[minmax(0,1fr)_6.5rem_6rem_4.5rem]",
                        active && "bg-sunken shadow-[inset_2px_0_0_var(--amber)]")}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0 text-ink-3" aria-label={e.schema === "Person" ? "Person" : "Organisation"} />
                        <span className="truncate text-[13.5px] text-ink" title={e.name}>{e.name}</span>
                      </span>
                      <span className="justify-self-end sm:justify-self-start"><ListTag source={e.source} /></span>
                      <span className="max-sm:col-start-1"><StatusMark status={e.status} /></span>
                      <span className="text-right text-[12px] text-ink-3 max-sm:col-start-2 max-sm:row-start-2">
                        {e.alerts > 0 ? <span className="text-amber"><span className="font-mono">{e.alerts}</span> {e.alerts === 1 ? "alert" : "alerts"}</span> : "no alerts"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {total > PAGE && (
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-2">
              <span className="tabular">{fmtInt(filters.page * PAGE + 1)}–{fmtInt(Math.min((filters.page + 1) * PAGE, total))} of {fmtInt(total)}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon-sm" onClick={() => onChange({ page: filters.page - 1 })} disabled={filters.page === 0} aria-label="Previous page"><ChevronLeft /></Button>
                <span className="tabular px-1">Page {filters.page + 1} of {fmtInt(pages)}</span>
                <Button variant="outline" size="icon-sm" onClick={() => onChange({ page: filters.page + 1 })} disabled={filters.page + 1 >= pages} aria-label="Next page"><ChevronRight /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
