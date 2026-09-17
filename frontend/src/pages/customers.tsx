import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { GroupTag } from "@/components/satark/badges";
import { DataTable, type Facet } from "@/components/satark/data-table";
import { ErrorState, Figure, PageHeader, Section } from "@/components/satark/page";
import { KindIcon, RegistryStatus, countryText, identifierText } from "@/components/customer/registry";
import { q } from "@/lib/api";
import { GROUPS, fmtDate, fmtInt } from "@/lib/format";
import type { Customer } from "@/lib/types";

const KIND_LABEL: Record<Customer["kind"], string> = { person: "Person", org: "Organisation" };

const FACETS: Facet[] = [
  { columnId: "group", title: "Group", options: (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => ({ value: g, label: `${g} — ${GROUPS[g].label}` })) },
  { columnId: "kind", title: "Kind", options: (["person", "org"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
];

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name", header: "Name",
    cell: ({ row }) => (
      <span className="flex min-w-48 items-center gap-2 text-ink">
        <KindIcon kind={row.original.kind} />
        <span className="[overflow-wrap:anywhere]">{row.original.name}</span>
      </span>
    ),
  },
  { accessorKey: "kind", header: "Kind", enableGlobalFilter: false, cell: ({ getValue }) => <span className="text-ink-2">{KIND_LABEL[getValue<Customer["kind"]>()]}</span> },
  { accessorKey: "group", header: "Group", enableGlobalFilter: false, cell: ({ getValue }) => <GroupTag group={getValue<string>()} /> },
  {
    id: "identifier", accessorFn: (c) => identifierText(c), header: "LEI / officer id",
    cell: ({ row }) => {
      const text = identifierText(row.original);
      if (!text) return <span className="text-ink-3">—</span>;
      return row.original.details.lei ? <span className="font-mono text-xs text-ink">{text}</span> : <span className="text-ink-2">{text}</span>;
    },
  },
  { id: "registry", header: "Registry status", cell: ({ row }) => <RegistryStatus details={row.original.details} /> },
  {
    id: "country", accessorFn: (c) => countryText(c), header: "Country", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-2">{getValue<string>() || "—"}</span>,
  },
  {
    id: "alerts", accessorFn: (c) => c.open_alerts ?? 0, header: "Open cases", enableGlobalFilter: false,
    cell: ({ getValue }) => {
      const n = getValue<number>();
      return <span className={n > 0 ? "font-mono text-amber" : "font-mono text-ink-3"}>{fmtInt(n)}</span>;
    },
  },
  {
    id: "screened", accessorKey: "last_screened_at", header: "Last screened", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap font-mono text-xs text-ink-2">{fmtDate(getValue<string>())}</span>,
  },
];

function SummaryStrip({ customers }: { customers: Customer[] }) {
  const groups = Object.keys(GROUPS) as (keyof typeof GROUPS)[];
  const byGroup = Object.fromEntries(groups.map((g) => [g, customers.filter((c) => c.group === g).length]));
  const persons = customers.filter((c) => c.kind === "person").length;
  const orgs = customers.filter((c) => c.kind === "org").length;
  const openCases = customers.filter((c) => (c.open_alerts ?? 0) > 0).length;
  return (
    <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-5">
      {groups.map((g) => (
        <div key={g} className="bg-panel p-3" title={GROUPS[g].long}>
          <Figure value={fmtInt(byGroup[g])} label={`Group ${g}`} sub={GROUPS[g].label} />
        </div>
      ))}
      <div className="bg-panel p-3">
        <Figure value={`${fmtInt(persons)} / ${fmtInt(orgs)}`} label="Persons / orgs" sub="Directors and officers vs LEI-holding entities" />
      </div>
      <div className="bg-panel p-3">
        <Figure value={fmtInt(openCases)} label="With open cases" tone="text-amber" sub={`Of ${fmtInt(customers.length)} customers`} />
      </div>
    </div>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const customers = useQuery(q.customers());
  const items = useMemo(() => customers.data?.items ?? [], [customers.data]);
  const sources = Object.entries(GROUPS).map(([g, info]) => `${info.long} (Group ${g})`).join("; ");

  return (
    <div className="space-y-5">
      <PageHeader code="CUS" title="Customers" description={`${fmtInt(customers.data?.total ?? 0)} counterparties from three sources: ${sources}.`} />
      {customers.error ? <ErrorState error={customers.error} what="customers" /> : (
        <>
          {items.length > 0 && <SummaryStrip customers={items} />}
          <Section title="Registry board" description="Every counterparty on the book. Rows open the customer profile.">
            <DataTable<Customer>
              columns={columns}
              data={items}
              loading={customers.isPending}
              searchPlaceholder="Search customers"
              facets={FACETS}
              initialSorting={[{ id: "name", desc: false }]}
              onRowClick={(c) => navigate(`/customers/${c.id}`)}
              rowLabel={(c) => `Open customer ${c.name}`}
              emptyTitle="No customers match"
              emptyHint="Clear the search or facet filters to see the full book."
            />
          </Section>
        </>
      )}
    </div>
  );
}
