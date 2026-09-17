import { useQuery } from "@tanstack/react-query";
import { CornerDownRight } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, sqrtPct, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  value: number;
  /** What happened between the previous step and this one, in words. */
  note?: string;
  noteTone?: string;
}

/** Each step is a real count from the live API, and each transition says why the count changed. */
export function ScreeningFunnel() {
  const stats = useQuery(q.stats());
  const alerts = useQuery(q.alerts());
  const cases = useQuery(q.cases());
  const error = stats.error ?? alerts.error ?? cases.error;
  if (error) return <ErrorState error={error} what="the screening funnel" />;
  if (!stats.data || !alerts.data || !cases.data) return <LoadingBlock rows={7} />;

  const s = stats.data;
  const customersWithAlert = new Set(
    alerts.data.items.filter((a) => a.entity?.status === "active" && a.customer?.id != null).map((a) => a.customer!.id),
  ).size;
  const alertsRaised = alerts.data.total;
  const autoCleared = s.alerts_by_status.auto_cleared ?? 0;
  const openAlerts = alertsRaised - autoCleared;
  const decided = cases.data.items.filter((c) => c.decision !== "").length;

  const steps: Step[] = [
    { label: "Customers", value: s.customers },
    { label: "Hit an active listing", value: customersWithAlert, note: `${fmtInt(s.customers - customersWithAlert)} had no name match at ${s.alert_threshold}+` },
    { label: "Alerts raised", value: alertsRaised, note: "a customer can match more than one list" },
    { label: "Left after identity check", value: openAlerts, note: `${fmtInt(autoCleared)} auto-cleared by identity evidence`, noteTone: "text-cleared" },
    { label: "Cases", value: cases.data.total, note: "grouped into one case per customer" },
    { label: "Decided", value: decided, note: decided ? "approved by a second reviewer" : "none approved by a second reviewer yet" },
  ];
  const max = Math.max(...steps.map((step) => step.value));

  return (
    <div>
      <ol aria-label={`Screening funnel. ${steps.map((step) => `${step.label}: ${fmtInt(step.value)}`).join(", ")}`}>
        {steps.map((step, i) => (
          <li key={step.label} className={i > 0 ? "mt-1" : undefined}>
            {step.note && (
              <p className={cn("mb-0.5 flex items-center gap-1 pl-28 text-[11px] text-ink-3", step.noteTone)}>
                <CornerDownRight className="size-3 shrink-0" aria-hidden />
                {step.note}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className="label-caps w-28 shrink-0 leading-tight text-ink-2">{step.label}</p>
              <div className="h-4 min-w-0 flex-1 bg-sunken" aria-hidden>
                <div className={cn("h-full", i === 3 ? "bg-cleared" : "bg-signal")} style={{ width: `${sqrtPct(step.value, max)}%` }} />
              </div>
              <Num className="w-12 shrink-0 text-right text-[13px]">{fmtInt(step.value)}</Num>
            </div>
          </li>
        ))}
      </ol>
      <Takeaway>
        {fmtInt(customersWithAlert)} of {fmtInt(s.customers)} customers hit an active listing, raising {fmtInt(alertsRaised)} alerts. Identity evidence cleared{" "}
        {fmtInt(autoCleared)}, leaving {fmtInt(openAlerts)} in {fmtInt(cases.data.total)} cases, {fmtInt(decided)} decided so far.
      </Takeaway>
    </div>
  );
}
