import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { BandBadge, CaseStatusBadge, GroupTag } from "@/components/satark/badges";
import { fmtDate } from "@/lib/format";
import type { Alert, CaseDetail } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5 first:pl-0">
      <p className="label-caps text-ink-3">{label}</p>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  );
}

// Highest-scoring alert speaks for the case: the case has no top_band/top_score of its own.
const topAlert = (alerts: Alert[]) => alerts.reduce<Alert | null>((best, a) => (!best || a.score > best.score ? a : best), null);

/** Prints the case like a market quote: identity, status and the figure that opened it, side by side on a hairline strip. */
export function CaseQuote({ detail }: { detail: CaseDetail }) {
  const top = topAlert(detail.alerts);
  const customer = detail.customer;
  return (
    <div className="flex flex-wrap divide-x divide-rule border-y border-rule" role="group" aria-label="Case summary">
      <Field label="Status"><CaseStatusBadge status={detail.status} /></Field>
      {top && <Field label="Top band"><BandBadge band={top.band} /></Field>}
      {top && <Field label="Top score"><span className="font-mono tabular text-ink">{top.score.toFixed(1)}</span></Field>}
      {customer && <Field label="Group"><GroupTag group={customer.group} /></Field>}
      <Field label="Opened"><span className="tabular">{fmtDate(detail.created_at)}</span></Field>
      {customer && (
        <Field label="Customer">
          <Link to={`/customers/${customer.id}`} className="inline-flex items-center gap-1 text-signal underline">
            Profile<ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </Field>
      )}
    </div>
  );
}
