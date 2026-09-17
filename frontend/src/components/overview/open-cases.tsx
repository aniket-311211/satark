import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { BAND_LABEL, fmtInt } from "@/lib/format";
import type { Band } from "@/lib/types";

const BANDS: Band[] = ["strong", "probable", "possible"];
const BAND_FILL: Record<Band, string> = { strong: "bg-strong", probable: "bg-probable", possible: "bg-possible", weak: "bg-sunken" };
const BAND_TEXT: Record<Band, string> = { strong: "text-strong", probable: "text-probable", possible: "text-possible", weak: "text-ink-2" };

/** The open-cases numeral never stands alone: its band split and the awaiting-review count ride beside it. */
export function OpenCases() {
  const stats = useQuery(q.stats());
  const open = useQuery(q.cases("open"));
  if (stats.error || open.error) return <ErrorState error={stats.error ?? open.error} what="open cases" />;
  if (!stats.data || !open.data) return <LoadingBlock rows={5} />;

  const total = stats.data.cases_by_status.open ?? 0;
  const awaiting = stats.data.cases_by_status.pending_approval ?? 0;
  const counts = BANDS.map((band) => ({ band, count: open.data.items.filter((c) => c.top_band === band).length }));
  const bandTotal = counts.reduce((n, c) => n + c.count, 0) || 1;

  return (
    <div className="flex h-full flex-col">
      <p className="font-mono text-6xl leading-none text-ink">{fmtInt(total)}</p>
      <p className="label-caps mt-1 text-ink-3">Open cases</p>

      <div className="mt-4">
        <div
          className="flex h-3 w-full overflow-hidden bg-sunken"
          role="img"
          aria-label={`Band split of open cases: ${counts.map((c) => `${c.count} ${BAND_LABEL[c.band]}`).join(", ")}`}
        >
          {counts.map((c) => c.count > 0 && (
            <div key={c.band} className={BAND_FILL[c.band]} style={{ width: `${(c.count / bandTotal) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          {counts.map((c) => (
            <li key={c.band} className={BAND_TEXT[c.band]}>
              <Num className={BAND_TEXT[c.band]}>{fmtInt(c.count)}</Num> {BAND_LABEL[c.band]}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border border-dashed border-amber px-3 py-2 text-amber">
        <p className="label-caps text-amber/80">Awaiting review</p>
        <p className="mt-0.5"><Num className="text-amber text-lg">{fmtInt(awaiting)}</Num> <span className="text-[12px] text-amber/80">with a second reviewer</span></p>
      </div>

      <Takeaway>
        {fmtInt(total)} open, {counts.find((c) => c.band === "strong")?.count ?? 0} of them strong-band; {fmtInt(awaiting)} more sit with a second reviewer.
      </Takeaway>

      <div className="mt-auto pt-4">
        <Button asChild>
          <Link to="/queue">Open the review queue <ArrowRight aria-hidden /></Link>
        </Button>
      </div>
    </div>
  );
}
