import { useQuery } from "@tanstack/react-query";
import { CircleDashed, Fingerprint, ShieldCheck } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt, VERDICT_LABEL } from "@/lib/format";
import type { Verdict } from "@/lib/types";

const ORDER: Verdict[] = ["contradicted", "confirmed", "inconclusive"];
const FILL: Record<Verdict, string> = { contradicted: "bg-cleared", confirmed: "bg-strong", inconclusive: "bg-sunken" };
const TEXT: Record<Verdict, string> = { contradicted: "text-cleared", confirmed: "text-strong", inconclusive: "text-ink-2" };
const ICON: Record<Verdict, typeof ShieldCheck> = { contradicted: ShieldCheck, confirmed: Fingerprint, inconclusive: CircleDashed };

/** The second, independent check: what identity evidence said about every alert, and why most says nothing yet. */
export function IdentityEvidence() {
  const alerts = useQuery(q.alerts());
  if (alerts.error) return <ErrorState error={alerts.error} what="identity evidence" />;
  if (!alerts.data) return <LoadingBlock rows={4} />;

  const items = alerts.data.items;
  const counts = ORDER.map((verdict) => ({ verdict, count: items.filter((a) => a.secondary?.verdict === verdict).length }));
  const total = items.length || 1;
  const inconclusive = counts.find((c) => c.verdict === "inconclusive")?.count ?? 0;
  const dobNoData = items.filter(
    (a) => a.secondary?.verdict === "inconclusive" && (a.secondary.checks ?? []).some((c) => c.check === "date_of_birth" && c.result === "no_data"),
  ).length;

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden bg-sunken"
        role="img"
        aria-label={`Identity evidence verdicts: ${counts.map((c) => `${c.count} ${VERDICT_LABEL[c.verdict]}`).join(", ")}`}
      >
        {counts.map((c) => c.count > 0 && <div key={c.verdict} className={FILL[c.verdict]} style={{ width: `${(c.count / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 space-y-1.5">
        {counts.map((c) => {
          const Icon = ICON[c.verdict];
          return (
            <li key={c.verdict} className={`flex items-center gap-1.5 text-[12.5px] ${TEXT[c.verdict]}`}>
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <Num className={TEXT[c.verdict]}>{fmtInt(c.count)}</Num>
              <span>{VERDICT_LABEL[c.verdict]}</span>
            </li>
          );
        })}
      </ul>
      <Takeaway>
        {fmtInt(dobNoData)} of {fmtInt(inconclusive)} inconclusive alerts have no date of birth at all on the listing side — the identity check has nothing to
        compare, not a contested one.
      </Takeaway>
    </div>
  );
}
