import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt, GROUPS } from "@/lib/format";
import { cn } from "@/lib/utils";

function Reading({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2 px-3 py-2", className)}>
      <span className="label-caps shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 text-[13px] text-ink-2">{children}</span>
    </div>
  );
}

/**
 * One line of live readings, the figures the wall below doesn't already carry: the book, the lists,
 * what screening raised and cleared, the audit chain, the news index and the benchmark.
 * Open cases and awaiting review live on the Open cases panel, so they aren't repeated here.
 */
export function Ticker() {
  const stats = useQuery(q.stats());
  const lists = useQuery(q.watchlists());
  const verify = useQuery(q.auditVerify());
  const feeds = useQuery(q.feeds());
  const report = useQuery(q.evalReport());

  const error = stats.error ?? lists.error ?? verify.error ?? feeds.error ?? report.error;
  if (error) return <ErrorState error={error} what="the live counts" />;
  if (!stats.data || !lists.data || !verify.data || !feeds.data || !report.data) return <LoadingBlock rows={1} />;

  const s = stats.data;
  const activeEntries = lists.data.reduce((n, l) => n + l.active, 0);
  const alertsRaised = Object.values(s.alerts_by_status).reduce((n, v) => n + v, 0);
  const autoCleared = s.alerts_by_status.auto_cleared ?? 0;
  const newsIndexed = feeds.data.reduce((n, f) => n + f.articles, 0);
  const groupShare = Object.keys(GROUPS).map((g) => `${g} ${fmtInt(s.customers_by_group[g] ?? 0)}`).join(" · ");

  return (
    <div className="flex flex-wrap divide-x divide-rule border border-rule bg-panel" role="group" aria-label="Live readings">
      <Reading label="Book"><span title={groupShare}><Num className="text-ink">{fmtInt(s.customers)}</Num> customers</span></Reading>
      <Reading label="Lists"><Num className="text-ink">{fmtInt(s.entities)}</Num> entries, <Num>{fmtInt(activeEntries)}</Num> active</Reading>
      <Reading label="Alerts"><Num className="text-ink">{fmtInt(alertsRaised)}</Num> at ≥<Num>{s.alert_threshold}</Num>, <Num className="text-cleared">{fmtInt(autoCleared)}</Num> auto-cleared</Reading>
      <Reading label="Audit">
        <span className={cn("inline-flex items-center gap-1", verify.data.ok ? "text-cleared" : "text-strong")}>
          {verify.data.ok ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldAlert className="size-3.5" aria-hidden />}
          <Num className="text-inherit">{fmtInt(verify.data.events)}</Num> {verify.data.ok ? "events, chain intact" : `events, broken at #${verify.data.broken_at ?? "?"}`}
        </span>
      </Reading>
      <Reading label="News"><Num className="text-ink">{fmtInt(newsIndexed)}</Num> articles, <Num>{feeds.data.length}</Num> feeds</Reading>
      <Reading label="F1"><Num className="text-ink">{report.data.systems.satark.f1.toFixed(3)}</Num> vs RapidFuzz <Num>{report.data.systems.rapidfuzz.f1.toFixed(3)}</Num></Reading>
    </div>
  );
}
