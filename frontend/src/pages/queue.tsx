import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Building2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertStatusBadge, BandBadge, CaseStatusBadge, GroupTag, ListTag, VerdictBadge } from "@/components/satark/badges";
import { ScoreMeter } from "@/components/satark/score";
import { DataTable, type Facet } from "@/components/satark/data-table";
import { ErrorState, LoadingBlock, PageHeader } from "@/components/satark/page";
import { q } from "@/lib/api";
import { BAND_LABEL, GROUPS, fmtDate, fmtInt } from "@/lib/format";
import type { Alert, Band, CaseRow, CaseStatus, Stats, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "pending_approval", label: "Awaiting review" },
  { value: "closed", label: "Closed" },
  { value: "auto_cleared", label: "Auto-cleared" },
] as const;
type View = (typeof VIEWS)[number]["value"];

// Line form: open reads solid, awaiting review dashed amber, closed and cleared read quiet.
const TAB_LINE: Record<View, string> = {
  open: "border-ink-2",
  pending_approval: "border-amber border-dashed",
  closed: "border-ink-3",
  auto_cleared: "border-cleared",
};
const ROW_LINE: Record<CaseStatus, string> = {
  open: "border-ink-2",
  pending_approval: "border-amber border-dashed",
  closed: "border-ink-3",
};

const FACETS: Facet[] = [
  { columnId: "group", title: "Group", options: Object.keys(GROUPS).map((g) => ({ value: g, label: g })) },
  { columnId: "band", title: "Band", options: (["strong", "probable", "possible"] as Band[]).map((b) => ({ value: b, label: BAND_LABEL[b] })) },
];

// A case can hold several alerts; the strongest verdict speaks for the row.
const caseVerdict = (verdicts: Record<string, number>): Verdict | "unchecked" =>
  (["confirmed", "contradicted", "inconclusive"] as Verdict[]).find((v) => verdicts[v]) ?? "unchecked";

// Cases opened this seeding day read in minutes or hours; the API gives no history to average.
function age(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function CustomerCell({ name, kind }: { name: string; kind: "person" | "org" }) {
  const Icon = kind === "org" ? Building2 : User;
  return (
    <span className="flex min-w-48 items-center gap-2 text-ink">
      <Icon className="size-4 shrink-0 text-ink-3" aria-label={kind === "org" ? "Organisation" : "Person"} />
      <span className="[overflow-wrap:anywhere]">{name}</span>
    </span>
  );
}

function caseColumns(threshold: number): ColumnDef<CaseRow>[] {
  return [
    { id: "customer", accessorFn: (r) => r.customer?.name ?? "", header: "Customer",
      cell: ({ row }) => <CustomerCell name={row.original.customer?.name ?? "—"} kind={row.original.customer?.kind ?? "org"} /> },
    { id: "group", accessorFn: (r) => r.customer?.group ?? "", header: "Group", cell: ({ getValue }) => <GroupTag group={getValue<string>()} /> },
    { id: "lists", accessorFn: (r) => r.lists.join(" "), header: "Lists hit", enableSorting: false,
      cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.lists.map((l) => <ListTag key={l} source={l} />)}</span> },
    { id: "band", accessorKey: "top_band", header: "Band", enableGlobalFilter: false,
      filterFn: (row, _id, band) => row.original.top_band === band,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("h-5 shrink-0 border-l-2", ROW_LINE[row.original.status])} />
          <BandBadge band={row.original.top_band} />
        </span>
      ) },
    { id: "score", accessorKey: "top_score", header: "Top score", sortDescFirst: true, enableGlobalFilter: false, enableColumnFilter: false,
      cell: ({ row }) => <ScoreMeter score={row.original.top_score} band={row.original.top_band || "weak"} threshold={threshold} className="w-40" /> },
    { id: "verdict", accessorFn: (r) => caseVerdict(r.verdicts), header: "Identity evidence", enableGlobalFilter: false,
      cell: ({ getValue }) => <VerdictBadge verdict={getValue<Verdict | "unchecked">()} /> },
    { id: "status", accessorKey: "status", header: "Status", enableGlobalFilter: false, cell: ({ row }) => <CaseStatusBadge status={row.original.status} /> },
    { id: "opened", accessorKey: "created_at", header: "Opened", enableGlobalFilter: false,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <span className="whitespace-nowrap"><span className="tabular text-ink-2">{fmtDate(v)}</span> <span className="tabular text-ink-3">· {age(v)}</span></span>;
      } },
    { id: "alerts", accessorKey: "alerts", header: "Alerts", cell: ({ getValue }) => <span className="tabular font-mono">{getValue<number>()}</span> },
  ];
}

function clearedColumns(threshold: number): ColumnDef<Alert>[] {
  return [
    { id: "customer", accessorFn: (r) => r.customer?.name ?? "", header: "Customer",
      cell: ({ row }) => <CustomerCell name={row.original.customer?.name ?? "—"} kind={row.original.customer?.kind ?? "person"} /> },
    { id: "group", accessorFn: (r) => r.customer?.group ?? "", header: "Group", cell: ({ getValue }) => <GroupTag group={getValue<string>()} /> },
    { id: "listed", accessorKey: "matched_name", header: "Listed as",
      cell: ({ row }) => (
        <span className="flex min-w-40 flex-wrap items-center gap-1.5 text-ink">
          {row.original.entity && <ListTag source={row.original.entity.source} />}
          {row.original.matched_name}
        </span>
      ) },
    { id: "band", accessorKey: "band", header: "Band", enableGlobalFilter: false,
      filterFn: (row, _id, band) => row.original.band === band,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-5 shrink-0 border-l-2 border-cleared" />
          <BandBadge band={row.original.band} />
        </span>
      ) },
    { id: "score", accessorKey: "score", header: "Name score", sortDescFirst: true, enableGlobalFilter: false, enableColumnFilter: false,
      cell: ({ row }) => <ScoreMeter score={row.original.score} band={row.original.band} threshold={threshold} className="w-40" /> },
    { id: "evidence", accessorFn: (r) => r.secondary?.summary ?? "", header: "Why it was cleared", enableSorting: false,
      cell: ({ getValue }) => <span className="block min-w-64 max-w-[42ch] whitespace-normal text-[13px] text-ink-2">{getValue<string>()}</span> },
    { id: "status", accessorKey: "status", header: "Status", enableGlobalFilter: false, cell: ({ row }) => <AlertStatusBadge status={row.original.status} /> },
    { id: "cleared", accessorKey: "decided_at", header: "Cleared", enableGlobalFilter: false,
      cell: ({ getValue }) => <span className="whitespace-nowrap tabular text-ink-2">{fmtDate(getValue<string>())}</span> },
  ];
}

function SummaryStrip({ open, pending, closed, cleared, stats }: {
  open: CaseRow[]; pending: CaseRow[]; closed: CaseRow[]; cleared: number; stats: UseQueryResult<Stats>;
}) {
  const all = [...open, ...pending, ...closed];
  const total = all.length;
  const bandCount = (b: Band) => all.filter((c) => c.top_band === b).length;
  const totalAlerts = stats.data ? Object.values(stats.data.alerts_by_status).reduce((a, b) => a + b, 0) : 0;
  const share = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}% of ${fmtInt(of)}` : undefined);
  const readings: { label: string; value: number; tone: string; sub?: string }[] = [
    { label: "Strong", value: bandCount("strong"), tone: "text-strong" },
    { label: "Probable", value: bandCount("probable"), tone: "text-probable" },
    { label: "Possible", value: bandCount("possible"), tone: "text-possible" },
  ];
  return (
    <div className="flex flex-col divide-y divide-rule sm:flex-row sm:flex-wrap sm:divide-x sm:divide-y-0 border border-rule bg-panel text-[13px]" role="group" aria-label="Case counts by band and outcome">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
        <span className="label-caps w-full text-ink-3 sm:w-auto">Top band, all {fmtInt(total)} cases</span>
        {readings.map((r) => (
          <span key={r.label} className={r.tone}><span className="font-mono">{fmtInt(r.value)}</span> {r.label.toLowerCase()}</span>
        ))}
      </div>
      <div className="flex items-baseline gap-2 border-t-2 border-dashed border-t-amber px-3 py-2 text-amber">
        <span className="label-caps">Awaiting review</span>
        <span><span className="font-mono">{fmtInt(pending.length)}</span> {total ? <span className="text-ink-2">({share(pending.length, total)} cases)</span> : null}</span>
      </div>
      <div className="flex items-baseline gap-2 border-t-2 border-t-cleared px-3 py-2 text-cleared">
        <span className="label-caps">Auto-cleared</span>
        <span><span className="font-mono">{fmtInt(cleared)}</span> {totalAlerts ? <span className="text-ink-2">({share(cleared, totalAlerts)} alerts)</span> : null}</span>
      </div>
    </div>
  );
}

export default function Queue() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.value === params.get("view"))?.value ?? "open") as View;
  const open = useQuery(q.cases("open"));
  const pending = useQuery(q.cases("pending_approval"));
  const closed = useQuery(q.cases("closed"));
  const cleared = useQuery(q.alerts("auto_cleared"));
  const stats = useQuery(q.stats());
  const byView = { open, pending_approval: pending, closed } as const;
  const counts: Record<View, number | undefined> = {
    open: open.data?.total, pending_approval: pending.data?.total, closed: closed.data?.total, auto_cleared: cleared.data?.total,
  };
  const threshold = stats.data?.alert_threshold ?? 80;
  const summaryError = open.error ?? pending.error ?? closed.error ?? cleared.error ?? stats.error;
  const summaryLoading = open.isPending || pending.isPending || closed.isPending || cleared.isPending || stats.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        brand
        title="Queue"
        description="One case per customer. An analyst proposes a decision with a rationale; a different reviewer approves it. Name matches cleared by independent identity evidence are listed separately, never deleted."
      />

      {summaryError ? <ErrorState error={summaryError} what="the queue summary" /> : summaryLoading ? <LoadingBlock rows={1} /> : (
        <SummaryStrip open={open.data?.items ?? []} pending={pending.data?.items ?? []} closed={closed.data?.items ?? []} cleared={cleared.data?.total ?? 0} stats={stats} />
      )}

      <Tabs value={view} onValueChange={(v) => setParams(v === "open" ? {} : { view: v }, { replace: true })}>
        <TabsList variant="line" className="h-auto w-full justify-start gap-x-5 overflow-x-auto border-b border-rule pb-1" aria-label="Queue views">
          {VIEWS.map((v) => {
            const active = v.value === view;
            return (
              <TabsTrigger key={v.value} value={v.value}
                className={cn("flex-none items-baseline gap-2 rounded-none border-0 bg-transparent px-0 py-2 text-sm shadow-none data-active:bg-transparent data-active:shadow-none",
                  active ? "text-ink after:bg-amber" : "text-ink-2")}>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("h-3 border-l-2", TAB_LINE[v.value])} />
                  {v.label}
                </span>
                <span className={cn("font-mono text-xs tabular", active ? "text-amber" : "text-ink-3")}>{counts[v.value] ?? "–"}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(["open", "pending_approval", "closed"] as const).map((status) => (
          <TabsContent key={status} value={status} className="pt-4">
            {byView[status].error ? <ErrorState error={byView[status].error} what="the queue" /> : (
              <DataTable<CaseRow>
                key={status}
                columns={caseColumns(threshold)}
                data={byView[status].data?.items ?? []}
                loading={byView[status].isPending}
                searchPlaceholder="Search customers"
                facets={FACETS}
                initialSorting={[{ id: "score", desc: true }]}
                onRowClick={(r) => navigate(`/cases/${r.id}`)}
                rowLabel={(r) => `Open case ${r.id} for ${r.customer?.name ?? "customer"}`}
                emptyTitle={status === "open" ? "No open cases" : status === "pending_approval" ? "Nothing is waiting for a reviewer" : "No closed cases yet"}
                emptyHint={status === "pending_approval"
                  ? <>Cases land here once an analyst proposes a decision. Open a case from the <Link to="/queue" className="text-signal underline">Open</Link> view to propose one.</>
                  : status === "closed" ? "A case closes when a reviewer who didn't propose the decision approves it." : "Rescreening the book raises new cases here."}
              />
            )}
          </TabsContent>
        ))}

        <TabsContent value="auto_cleared" className="pt-4">
          {cleared.error ? <ErrorState error={cleared.error} what="auto-cleared alerts" /> : (
            <DataTable<Alert>
              columns={clearedColumns(threshold)}
              data={cleared.data?.items ?? []}
              loading={cleared.isPending}
              searchPlaceholder="Search customers"
              facets={FACETS}
              initialSorting={[{ id: "score", desc: true }]}
              onRowClick={(r) => r.customer && navigate(`/customers/${r.customer.id}`)}
              rowLabel={(r) => `Open customer ${r.customer?.name ?? ""}`}
              emptyTitle="No alerts were auto-cleared"
              emptyHint="An alert is cleared automatically only when strong independent evidence, such as a date of birth two or more years apart, contradicts the name match."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
