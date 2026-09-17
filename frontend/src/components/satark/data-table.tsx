import { useState, type ReactNode } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ColumnFiltersState, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/satark/page";
import { cn } from "@/lib/utils";

export interface Facet {
  columnId: string;
  title: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  facets?: Facet[];
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  pageSize?: number;
  initialSorting?: SortingState;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}

/** Sortable, searchable, faceted, paginated table on TanStack Table + shadcn Table. Numbers render tabular. */
export function DataTable<T>({
  columns, data, loading, searchPlaceholder = "Search", facets = [], onRowClick, rowLabel, pageSize = 25, initialSorting = [],
  emptyTitle = "Nothing matches", emptyHint, toolbar, className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data, columns, state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter, onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } },
    defaultColumn: { filterFn: "equalsString" }, // facets filter on exact values; the search box stays a substring match
  });
  const rows = table.getRowModel().rows;
  const filtered = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;
  const from = filtered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, filtered);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder}
            className="h-8 rounded-sm border-rule bg-panel pl-9" />
        </label>
        {facets.map((facet) => {
          const column = table.getColumn(facet.columnId);
          const active = (column?.getFilterValue() as string | undefined) ?? "";
          return (
            <div key={facet.columnId} role="group" aria-label={facet.title} className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-ink-2">{facet.title}</span>
              {[{ value: "", label: "All" }, ...facet.options].map((option) => (
                <button key={option.value || "all"} type="button" aria-pressed={active === option.value}
                  onClick={() => { column?.setFilterValue(option.value || undefined); table.setPageIndex(0); }}
                  className={cn("h-7 cursor-pointer rounded-sm border px-2.5 text-xs transition-colors duration-150",
                    active === option.value ? "border-amber bg-amber-soft text-amber" : "border-rule bg-panel text-ink-2 hover:border-rule-strong hover:text-ink")}>
                  {option.label}
                </button>
              ))}
            </div>
          );
        })}
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
        <Table className="tabular">
          <TableHeader className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="border-rule hover:bg-transparent">
                {group.headers.map((header) => {
                  const sort = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id} aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      className="h-10 text-xs font-medium whitespace-nowrap text-ink-2">
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer items-center gap-1 rounded hover:text-ink">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sort === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sort === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                        </button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i} className="border-rule">
                  {columns.map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full max-w-40 bg-sunken" /></TableCell>)}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0"><EmptyState title={emptyTitle}>{emptyHint}</EmptyState></TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className={cn("border-rule", onRowClick && "cursor-pointer hover:bg-sunken/70 focus-visible:bg-sunken")}
                  tabIndex={onRowClick ? 0 : undefined} aria-label={onRowClick && rowLabel ? rowLabel(row.original) : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row.original); } : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && filtered > pageSize && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-2">
          <span className="tabular">{from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {filtered.toLocaleString("en-IN")}</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular px-1">Page {pageIndex + 1} of {table.getPageCount()}</span>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
