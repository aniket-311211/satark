import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt, GROUPS } from "@/lib/format";

function Cell({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 bg-panel px-2.5 py-2">
      <p className="label-caps leading-tight text-ink-3">{label}</p>
      <p className="mt-1 text-xl leading-none">{value}</p>
      {sub && <p className="mt-1 leading-snug text-[11px] text-ink-2">{sub}</p>}
    </div>
  );
}

/**
 * Ten live counts in one hairline strip: what's screened, what's open, whether the audit chain holds,
 * how much news is indexed, and where the benchmark stands. Every value is a single API round trip away.
 */
export function Ticker() {
  const stats = useQuery(q.stats());
  const lists = useQuery(q.watchlists());
  const verify = useQuery(q.auditVerify());
  const feeds = useQuery(q.feeds());
  const report = useQuery(q.evalReport());

  const error = stats.error ?? lists.error ?? verify.error ?? feeds.error ?? report.error;
  if (error) return <ErrorState error={error} what="the live counts" />;
  if (!stats.data || !lists.data || !verify.data || !feeds.data || !report.data) return <LoadingBlock rows={2} />;

  const s = stats.data;
  const activeEntries = lists.data.reduce((n, l) => n + l.active, 0);
  const historicalEntries = lists.data.reduce((n, l) => n + l.historical, 0);
  const alertsRaised = Object.values(s.alerts_by_status).reduce((n, v) => n + v, 0);
  const autoCleared = s.alerts_by_status.auto_cleared ?? 0;
  const totalCases = Object.values(s.cases_by_status).reduce((n, v) => n + v, 0);
  const newsIndexed = feeds.data.reduce((n, f) => n + f.articles, 0);
  const groupShare = Object.keys(GROUPS).map((g) => `${g} ${fmtInt(s.customers_by_group[g] ?? 0)}`).join(" · ");

  return (
    <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-5 xl:grid-cols-10" role="group" aria-label="Live screening counts">
      <Cell label="Customers screened" value={<Num>{fmtInt(s.customers)}</Num>} sub={groupShare} />
      <Cell label="List entries" value={<Num>{fmtInt(s.entities)}</Num>} sub={<><Num>{fmtInt(activeEntries)}</Num> active · <Num>{fmtInt(historicalEntries)}</Num> historical</>} />
      <Cell label="Alerts raised" value={<Num>{fmtInt(alertsRaised)}</Num>} sub={<>at score ≥ <Num>{s.alert_threshold}</Num></>} />
      <Cell label="Auto-cleared" value={<Num className="text-cleared">{fmtInt(autoCleared)}</Num>} sub={<>of <Num>{fmtInt(alertsRaised)}</Num> alerts, by identity evidence</>} />
      <Cell label="Open cases" value={<Num>{fmtInt(s.cases_by_status.open ?? 0)}</Num>} sub={<>of <Num>{fmtInt(totalCases)}</Num> total</>} />
      <Cell label="Awaiting review" value={<Num className="text-amber">{fmtInt(s.cases_by_status.pending_approval ?? 0)}</Num>} sub="with a second reviewer" />
      <Cell label="Closed" value={<Num>{fmtInt(s.cases_by_status.closed ?? 0)}</Num>} sub={<>of <Num>{fmtInt(totalCases)}</Num> total</>} />
      <Cell
        label="Audit events"
        value={<Num className={verify.data.ok ? "text-cleared" : "text-strong"}>{fmtInt(verify.data.events)}</Num>}
        sub={
          <span className="inline-flex items-center gap-1">
            {verify.data.ok ? <ShieldCheck className="size-3" aria-hidden /> : <ShieldAlert className="size-3" aria-hidden />}
            {verify.data.ok ? "chain intact" : `chain broken at #${verify.data.broken_at ?? "?"}`}
          </span>
        }
      />
      <Cell label="News indexed" value={<Num>{fmtInt(newsIndexed)}</Num>} sub={<>across <Num>{feeds.data.length}</Num> feeds</>} />
      <Cell
        label="Benchmark F1"
        value={<Num>{report.data.systems.satark.f1.toFixed(3)}</Num>}
        sub={<>Satark vs <Num>{report.data.systems.rapidfuzz.f1.toFixed(3)}</Num> RapidFuzz</>}
      />
    </div>
  );
}
