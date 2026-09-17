import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Building2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertStatusBadge, BandBadge, CaseStatusBadge, GroupTag, ListTag, VerdictBadge } from "@/components/satark/badges";
import { DataTable, type Facet } from "@/components/satark/data-table";
import { ErrorState, PageHeader } from "@/components/satark/page";
import { q } from "@/lib/api";
import { BAND_LABEL, GROUPS, fmtDate } from "@/lib/format";
import type { Alert, Band, CaseRow, Verdict } from "@/lib/types";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "pending_approval", label: "Awaiting review" },
  { value: "closed", label: "Closed" },
  { value: "auto_cleared", label: "Auto-cleared" },
] as const;
type View = (typeof VIEWS)[number]["value"];

const FACETS: Facet[] = [
  { columnId: "group", title: "Group", options: Object.keys(GROUPS).map((g) => ({ value: g, label: g })) },
  { columnId: "score", title: "Band", options: (["strong", "probable", "possible"] as Band[]).map((b) => ({ value: b, label: BAND_LABEL[b] })) },
];

// A case can hold several alerts; the strongest verdict speaks for the row.
const caseVerdict = (verdicts: Record<string, number>): Verdict | "unchecked" =>
  (["confirmed", "contradicted", "inconclusive"] as Verdict[]).find((v) => verdicts[v]) ?? "unchecked";

function CustomerCell({ name, kind }: { name: string; kind: "person" | "org" }) {
  const Icon = kind === "org" ? Building2 : User;
  return (
    <span className="flex min-w-48 items-center gap-2 text-ink">
      <Icon className="size-4 shrink-0 text-ink-3" aria-label={kind === "org" ? "Organisation" : "Person"} />
      <span className="[overflow-wrap:anywhere]">{name}</span>
    </span>
  );
}

const caseColumns: ColumnDef<CaseRow>[] = [
  { id: "customer", accessorFn: (r) => r.customer?.name ?? "", header: "Customer",
    cell: ({ row }) => <CustomerCell name={row.original.customer?.name ?? "—"} kind={row.original.customer?.kind ?? "org"} /> },
  { id: "group", accessorFn: (r) => r.customer?.group ?? "", header: "Group", cell: ({ getValue }) => <GroupTag group={getValue<string>()} /> },
  { id: "lists", accessorFn: (r) => r.lists.join(" "), header: "Lists hit", enableSorting: false,
    cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.lists.map((l) => <ListTag key={l} source={l} />)}</span> },
  { id: "score", accessorKey: "top_score", header: "Top score", sortDescFirst: true, enableGlobalFilter: false,
    filterFn: (row, _id, band) => row.original.top_band === band,
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span className="w-10 text-right font-mono text-sm">{row.original.top_score.toFixed(1)}</span>
        <BandBadge band={row.original.top_band} />
      </span>
    ) },
  { id: "verdict", accessorFn: (r) => caseVerdict(r.verdicts), header: "Identity evidence", enableGlobalFilter: false,
    cell: ({ getValue }) => <VerdictBadge verdict={getValue<Verdict | "unchecked">()} /> },
  { id: "alerts", accessorKey: "alerts", header: "Alerts", cell: ({ getValue }) => <span className="font-mono">{getValue<number>()}</span> },
  { id: "status", accessorKey: "status", header: "Status", enableGlobalFilter: false, cell: ({ row }) => <CaseStatusBadge status={row.original.status} /> },
  { id: "opened", accessorKey: "created_at", header: "Opened", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-2">{fmtDate(getValue<string>())}</span> },
];

const clearedColumns: ColumnDef<Alert>[] = [
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
  { id: "score", accessorKey: "score", header: "Name score", sortDescFirst: true, enableGlobalFilter: false,
    filterFn: (row, _id, band) => row.original.band === band,
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span className="w-10 text-right font-mono text-sm">{row.original.score.toFixed(1)}</span>
        <BandBadge band={row.original.band} />
      </span>
    ) },
  { id: "evidence", accessorFn: (r) => r.secondary?.summary ?? "", header: "Why it was cleared", enableSorting: false,
    cell: ({ getValue }) => <span className="block min-w-64 max-w-[42ch] text-[13px] text-ink-2">{getValue<string>()}</span> },
  { id: "status", accessorKey: "status", header: "Status", enableGlobalFilter: false, cell: ({ row }) => <AlertStatusBadge status={row.original.status} /> },
  { id: "cleared", accessorKey: "decided_at", header: "Cleared", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-2">{fmtDate(getValue<string>())}</span> },
];

export default function Queue() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.value === params.get("view"))?.value ?? "open") as View;
  const open = useQuery(q.cases("open"));
  const pending = useQuery(q.cases("pending_approval"));
  const closed = useQuery(q.cases("closed"));
  const cleared = useQuery(q.alerts("auto_cleared"));
  const byView = { open, pending_approval: pending, closed } as const;
  const counts: Record<View, number | undefined> = {
    open: open.data?.total, pending_approval: pending.data?.total, closed: closed.data?.total, auto_cleared: cleared.data?.total,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review queue"
        description="One case per customer. An analyst proposes a decision with a rationale; a different reviewer approves it. Name matches cleared by independent identity evidence are listed separately, never deleted."
      />
      <Tabs value={view} onValueChange={(v) => setParams(v === "open" ? {} : { view: v }, { replace: true })}>
        <TabsList variant="line" className="h-auto flex-wrap justify-start gap-x-4 border-b border-rule pb-1" aria-label="Queue views">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="flex-none px-0 text-sm">
              {v.label}
              <span className="font-mono text-xs text-ink-2">{counts[v.value] ?? "–"}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(["open", "pending_approval", "closed"] as const).map((status) => (
          <TabsContent key={status} value={status} className="pt-4">
            {byView[status].error ? <ErrorState error={byView[status].error} what="the queue" /> : (
              <DataTable<CaseRow>
                key={status}
                columns={caseColumns}
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
              columns={clearedColumns}
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
