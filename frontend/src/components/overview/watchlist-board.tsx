import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";

/** Every list, active versus historical. A list can be large and mostly historical and still stay fully searchable. */
export function WatchlistBoard() {
  const lists = useQuery(q.watchlists());
  if (lists.error) return <ErrorState error={lists.error} what="the watchlist board" />;
  if (!lists.data) return <LoadingBlock rows={5} />;

  const max = Math.max(1, ...lists.data.map((l) => l.entities));
  const mostHistorical = [...lists.data].filter((l) => l.entities > 0).sort((a, b) => b.historical / b.entities - a.historical / a.entities)[0];

  return (
    <div>
      <ul className="space-y-2.5" role="group" aria-label="Active versus historical entries per watchlist">
        {lists.data.map((l) => (
          <li key={l.key}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate text-ink" title={l.label}>{l.label}</span>
              <span className="shrink-0 text-ink-3"><Num className="text-ink-2">{fmtInt(l.active)}</Num> active · <Num className="text-ink-3">{fmtInt(l.historical)}</Num> historical</span>
            </div>
            {/* Line form: active entries run full height, historical ones half height. */}
            <div className="mt-1 flex h-2.5 w-full items-end overflow-hidden border-b border-rule" aria-hidden>
              <div className="h-full bg-signal" style={{ width: `${(l.active / max) * 100}%` }} />
              <div className="h-1/2 bg-ink-3" style={{ width: `${(l.historical / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {mostHistorical && (
        <Takeaway>
          {mostHistorical.label} is the most historical list: {fmtInt(mostHistorical.historical)} of {fmtInt(mostHistorical.entities)} entries
          ({Math.round((mostHistorical.historical / mostHistorical.entities) * 100)}%) are revoked or expired, still searchable but no longer raising alerts.
        </Takeaway>
      )}
    </div>
  );
}
