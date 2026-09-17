import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { GroupTag } from "@/components/satark/badges";
import { DataTable, type Facet } from "@/components/satark/data-table";
import { ErrorState, PageHeader } from "@/components/satark/page";
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
    id: "identifier", accessorFn: (c) => identifierText(c), header: "Identifier",
    cell: ({ row }) => {
      const text = identifierText(row.original);
      if (!text) return <span className="text-ink-3">—</span>;
      return row.original.details.lei ? <span className="font-mono text-xs text-ink">{text}</span> : <span className="text-ink-2">{text}</span>;
    },
  },
  { id: "registry", header: "Registry status", cell: ({ row }) => <RegistryStatus details={row.original.details} /> },
  {
    id: "country", accessorFn: (c) => countryText(c), header: "Country / jurisdiction", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-2">{getValue<string>() || "—"}</span>,
  },
  {
    id: "alerts", accessorFn: (c) => c.open_alerts ?? 0, header: "Open alerts", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="font-mono text-ink">{fmtInt(getValue<number>())}</span>,
  },
  {
    id: "screened", accessorKey: "last_screened_at", header: "Last screened", enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="whitespace-nowrap text-ink-2">{fmtDate(getValue<string>())}</span>,
  },
];

export default function Customers() {
  const navigate = useNavigate();
  const customers = useQuery(q.customers());
  const sources = Object.entries(GROUPS).map(([g, info]) => `${info.long} (Group ${g})`).join("; ");

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${fmtInt(customers.data?.total ?? 0)} counterparties from three sources: ${sources}.`} />
      {customers.error ? <ErrorState error={customers.error} what="customers" /> : (
        <DataTable<Customer>
          columns={columns}
          data={customers.data?.items ?? []}
          loading={customers.isPending}
          searchPlaceholder="Search customers"
          facets={FACETS}
          initialSorting={[{ id: "name", desc: false }]}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          rowLabel={(c) => `Open customer ${c.name}`}
          emptyTitle="No customers match"
          emptyHint="Clear the search or facet filters to see the full book."
        />
      )}
    </div>
  );
}
