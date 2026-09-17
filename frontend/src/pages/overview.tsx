import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowRight, CircleCheck, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BandBadge, CaseStatusBadge, GroupTag, ListTag, VerdictBadge } from "@/components/satark/badges";
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { ListComposition } from "@/components/overview/list-composition";
import { f1At, QualityChart } from "@/components/overview/quality";
import { ScreeningSieve, sieveRows, sieveTakeaway } from "@/components/overview/sieve";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { CaseRow, Verdict } from "@/lib/types";

const leadVerdict = (v: Record<string, number>): Verdict | "unchecked" =>
  v.confirmed ? "confirmed" : v.inconclusive ? "inconclusive" : v.contradicted ? "contradicted" : "unchecked";

function Ledger() {
  const stats = useQuery(q.stats());
  const lists = useQuery(q.watchlists());
  if (stats.error || lists.error) return <ErrorState error={stats.error ?? lists.error} what="the headline numbers" />;
  if (!stats.data || !lists.data) return <LoadingBlock rows={1} />;
  const active = lists.data.reduce((n, l) => n + l.active, 0);
  const historical = lists.data.reduce((n, l) => n + l.historical, 0);
  const s = stats.data;
  const n = (v: number) => <span className="font-medium tabular text-ink">{fmtInt(v)}</span>;
  return (
    <p className="text-[15px] leading-relaxed text-ink-2">
      Screening {n(s.customers)} customers against {n(s.entities)} list entries ({n(active)} active, {n(historical)} historical).{" "}
      {n(s.cases_by_status.open ?? 0)} cases are open, {n(s.cases_by_status.pending_approval ?? 0)} await a reviewer, and identity
      evidence has auto-cleared {n(s.alerts_by_status.auto_cleared ?? 0)} alerts.
    </p>
  );
}

function Sieve() {
  const stats = useQuery(q.stats());
  if (stats.error) return <ErrorState error={stats.error} what="the screening breakdown" />;
  if (!stats.data) return <LoadingBlock rows={3} />;
  const rows = sieveRows(stats.data);
  return (
    <>
      <ScreeningSieve rows={rows} />
      <p className="mt-3 max-w-[72ch] text-[13px] text-ink-2">{sieveTakeaway(rows)}</p>
    </>
  );
}

function AttentionList() {
  const cases = useQuery(q.cases());
  if (cases.error) return <ErrorState error={cases.error} what="cases" />;
  if (!cases.data) return <LoadingBlock rows={6} />;
  const rows: CaseRow[] = cases.data.items.filter((c) => c.status !== "closed").sort((a, b) => b.top_score - a.top_score).slice(0, 6);
  if (!rows.length) return <EmptyState title="No cases need attention">New alerts open a case here; closed cases stay in the review queue.</EmptyState>;
  return (
    <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
      {rows.map((c) => (
        <li key={c.id}>
          <Link to={`/cases/${c.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-sunken/70 focus-visible:bg-sunken sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{c.customer?.name ?? `Case ${c.id}`}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <GroupTag group={c.customer?.group ?? ""} withLabel={false} />
                {c.lists.map((l) => <ListTag key={l} source={l} />)}
                <VerdictBadge verdict={leadVerdict(c.verdicts)} />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm tabular text-ink">{c.top_score.toFixed(1)}</span>
                <BandBadge band={c.top_band} />
              </span>
              <CaseStatusBadge status={c.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Quality() {
  const report = useQuery(q.evalReport());
  const real = useQuery(q.evalReal());
  const stats = useQuery(q.stats());
  const threshold = stats.data?.alert_threshold ?? 80;
  if (report.error) return <ErrorState error={report.error} what="the benchmark report" />;
  if (!report.data) return <LoadingBlock rows={4} />;
  const s = f1At(report.data, "satark", threshold);
  const r = f1At(report.data, "rapidfuzz", threshold);
  const allPass = real.data && real.data.passed === real.data.cases;
  return (
    <>
      <QualityChart report={report.data} threshold={threshold} />
      <p className="mt-2 text-[13px] text-ink-2">
        At the production threshold of {threshold}, Satark's F1 is <span className="font-mono tabular text-ink">{s?.toFixed(3) ?? "—"}</span> against
        RapidFuzz's <span className="font-mono tabular text-ink">{r?.toFixed(3) ?? "—"}</span> on the held-out half of {fmtInt(report.data.cases.total)} synthetic queries.
      </p>
      {real.data && (
        <Link to="/benchmark" className="mt-3 inline-flex items-center gap-2 text-sm text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
          {allPass ? <CircleCheck className="size-4 text-cleared" aria-hidden /> : <CircleAlert className="size-4 text-strong" aria-hidden />}
          {real.data.passed} of {real.data.cases} real labelled cases pass
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </>
  );
}

function Composition() {
  const lists = useQuery(q.watchlists());
  if (lists.error) return <ErrorState error={lists.error} what="watchlists" />;
  if (!lists.data) return <LoadingBlock rows={5} />;
  const nse = lists.data.find((l) => l.key === "in_nse_debarred");
  return (
    <>
      <ListComposition lists={lists.data} mode="share" />
      {nse && nse.entities > 0 && (
        <p className="mt-2 text-[13px] text-ink-2">
          {Math.round((nse.historical / nse.entities) * 100)}% of NSE debarments ({fmtInt(nse.historical)} of {fmtInt(nse.entities)}) are revoked or expired, so
          they stay searchable but no longer raise alerts. Right-hand labels read active / historical.
        </p>
      )}
    </>
  );
}

export default function Overview() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Overview"
        description="What the lists, the customer book and the two checks look like today."
        actions={
          <Button asChild>
            <Link to="/queue">Open the review queue <ArrowRight aria-hidden /></Link>
          </Button>
        }
      />
      <Ledger />
      <Section title="Screening, by customer group" description="Customers, the alerts they raised on active listings, and what the identity check did with them.">
        <Sieve />
      </Section>
      <div className="grid gap-10 border-t border-rule pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Section title="Cases needing attention" description="Open or awaiting review, highest name match first."
          actions={<Link to="/queue" className="text-sm text-signal underline underline-offset-4">All cases</Link>}>
          <AttentionList />
        </Section>
        <Section title="Matching quality" description="F1 by alert threshold, synthetic benchmark.">
          <Quality />
        </Section>
      </div>
      <Section className="border-t border-rule pt-8" title="Watchlist composition" description="Share of each list that is active versus historical."
        actions={<Link to="/lists" className="text-sm text-signal underline underline-offset-4">Watchlist details</Link>}>
        <Composition />
      </Section>
    </div>
  );
}
