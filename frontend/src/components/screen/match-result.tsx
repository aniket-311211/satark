import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { IdentityEvidencePanel, NameMatchPanel } from "@/components/satark/checks";
import { EntityRecord } from "@/components/satark/entity-record";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { q } from "@/lib/api";
import type { Match } from "@/lib/types";

/** One candidate: both checks side by side, a historical-listing marker, and a disclosure that loads the source listing on demand. */
export function MatchResult({ match, queryName, threshold }: { match: Match; queryName: string; threshold: number }) {
  const [open, setOpen] = useState(false);
  const entity = useQuery({ ...q.entity(match.entity_id), enabled: open });

  return (
    <li className="border-b border-rule py-6 first:pt-0 last:border-0">
      {match.status === "historical" && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-2">
          Historical listing: would not raise an alert
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <NameMatchPanel score={match.score} band={match.band} matchedName={match.matched_name} customerName={queryName}
          reasons={match.reasons} pairs={match.pairs} threshold={threshold} />
        <IdentityEvidencePanel secondary={match.secondary} />
      </div>
      <details className="group mt-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm text-signal underline underline-offset-4">
          Show the listing
          <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-4">
          {entity.error ? <ErrorState error={entity.error} what="the listing" /> : !entity.data ? <LoadingBlock rows={3} /> : <EntityRecord entity={entity.data} />}
        </div>
      </details>
    </li>
  );
}
