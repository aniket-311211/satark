import type { ColumnDef } from "@tanstack/react-table";
import { Check, CircleAlert, CircleCheck, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable, type Facet } from "@/components/satark/data-table";
import { EmptyState } from "@/components/satark/page";
import { fmtInt, titleCase } from "@/lib/format";
import type { EvalReport, RealCase, RealEval } from "@/lib/types";
import { cn } from "@/lib/utils";

const FACETS: Facet[] = [
  { columnId: "expected", title: "Expected", options: [{ value: "match", label: "Match" }, { value: "no_match", label: "No match" }] },
  { columnId: "passed", title: "Result", options: [{ value: "true", label: "Passed" }, { value: "false", label: "Failed" }] },
];

const columns: ColumnDef<RealCase>[] = [
  { id: "query", accessorKey: "query", header: "Query", cell: ({ getValue }) => <span className="text-ink [overflow-wrap:anywhere]">{getValue<string>()}</span> },
  { id: "expected", accessorKey: "expected", header: "Expected", cell: ({ getValue }) => <span className="text-ink-2">{getValue<string>() === "match" ? "Match" : "No match"}</span> },
  { id: "score", accessorKey: "score", header: "Score", sortDescFirst: true, enableGlobalFilter: false,
    cell: ({ row }) => <span className="font-mono text-sm tabular text-ink">{row.original.score.toFixed(1)} <span className="text-ink-3">/ 80</span></span> },
  { id: "passed", accessorFn: (r) => String(r.passed), header: "Passed", enableGlobalFilter: false,
    cell: ({ row }) => (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", row.original.passed ? "text-cleared" : "text-strong")}>
        {row.original.passed ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
        {row.original.passed ? "Passed" : "Failed"}
      </span>
    ) },
  { id: "origin", accessorKey: "origin", header: "Origin", cell: ({ getValue }) => <span className="text-ink-2">{titleCase(getValue<string>())}</span> },
  { id: "note", accessorKey: "note", header: "Note", enableSorting: false, enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="block max-w-[44ch] text-[13px] whitespace-normal text-ink-2">{getValue<string>()}</span> },
];

export function RealCasesTable({ evalReal }: { evalReal: RealEval }) {
  const allPass = evalReal.passed === evalReal.cases;
  return (
    <div>
      <p className="flex items-center gap-2 text-[15px] text-ink">
        {allPass ? <CircleCheck className="size-4 text-cleared" aria-hidden /> : <CircleAlert className="size-4 text-strong" aria-hidden />}
        {fmtInt(evalReal.passed)} of {fmtInt(evalReal.cases)} real labelled cases pass at threshold {evalReal.threshold}.
      </p>
      <DataTable<RealCase>
        className="mt-4"
        columns={columns}
        data={evalReal.results}
        searchPlaceholder="Search queries"
        facets={FACETS}
        initialSorting={[{ id: "score", desc: true }]}
        emptyTitle="No real labelled cases"
      />
    </div>
  );
}

export function SatarkMisses({ report }: { report: EvalReport }) {
  if (report.satark_misses.length === 0) return <EmptyState title="No misses">Satark caught every positive query in the held-out test set at its dev-picked threshold.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <Table className="tabular">
        <TableHeader>
          <TableRow className="border-rule hover:bg-transparent">
            <TableHead className="text-xs font-medium text-ink-2">Query</TableHead>
            <TableHead className="text-xs font-medium text-ink-2">Expected</TableHead>
            <TableHead className="text-xs font-medium text-ink-2">Transform</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Top score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.satark_misses.map((m, i) => (
            <TableRow key={i} className="border-rule">
              <TableCell className="py-2 text-ink">{m.query}</TableCell>
              <TableCell className="py-2 text-ink-2">{m.expected}</TableCell>
              <TableCell className="py-2 text-ink-2">{titleCase(m.transform)}</TableCell>
              <TableCell className="py-2 text-right font-mono text-ink">{m.top_score !== null ? m.top_score.toFixed(1) : "no match"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
