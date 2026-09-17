import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import { ChevronDown, RotateCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/satark/data-table";
import { ErrorState, Facts, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { q } from "@/lib/api";
import { fmtInt, fmtTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const shortHash = (h: string) => h.slice(0, 8);

function detailItems(detail: Record<string, unknown>): [string, string][] {
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
}

function TargetCell({ target }: { target: string }) {
  const [kind, idStr] = target.split(":");
  const id = Number(idStr);
  if (kind === "case" && Number.isFinite(id)) return <Link to={`/cases/${id}`} className="text-signal underline">{target}</Link>;
  if (kind === "customer" && Number.isFinite(id)) return <Link to={`/customers/${id}`} className="text-signal underline">{target}</Link>;
  return <span className="text-ink">{target}</span>;
}

function DetailCell({ detail }: { detail: Record<string, unknown> }) {
  const items = detailItems(detail);
  if (items.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-mono text-xs text-ink-2 marker:content-none focus-visible:outline-none hover:text-ink">
        <ChevronDown className="size-3 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        {items.length} field{items.length === 1 ? "" : "s"}
      </summary>
      <Facts className="mt-2 max-w-[46ch] whitespace-normal" items={items.map(([k, v]) => [k, <span className="font-mono text-xs break-all whitespace-normal">{v}</span>] as [string, React.ReactNode])} />
    </details>
  );
}

const columns: ColumnDef<AuditEntry>[] = [
  { id: "at", accessorKey: "at", header: "Time", sortDescFirst: true,
    cell: ({ getValue }) => <span className="whitespace-nowrap font-mono tabular text-ink-2">{fmtTime(getValue<string>())}</span> },
  { id: "actor", accessorKey: "actor", header: "Actor", cell: ({ getValue }) => <span className="text-ink">{getValue<string>()}</span> },
  { id: "action", accessorKey: "action", header: "Action", cell: ({ getValue }) => <span className="font-mono text-xs text-ink">{getValue<string>()}</span> },
  { id: "target", accessorKey: "target", header: "Target", cell: ({ getValue }) => <TargetCell target={getValue<string>()} /> },
  { id: "detail", accessorFn: (r) => JSON.stringify(r.detail), header: "Detail", enableSorting: false,
    cell: ({ row }) => <DetailCell detail={row.original.detail} /> },
];

function VerifyBanner() {
  const verify = useQuery(q.auditVerify());
  if (verify.error) return <ErrorState error={verify.error} what="chain verification" />;
  if (!verify.data) return <LoadingBlock rows={1} />;
  const v = verify.data;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-3 text-sm",
        v.ok ? "border-cleared/40 bg-cleared-soft text-cleared" : "border-strong/40 border-dashed bg-strong-soft font-medium text-strong",
      )}
    >
      <span className="flex items-center gap-2">
        {v.ok ? <ShieldCheck className="size-4 shrink-0" aria-hidden /> : <ShieldAlert className="size-4 shrink-0" aria-hidden />}
        {v.ok ? (
          <>Chain intact · <span className="tabular">{fmtInt(v.events)}</span> events · head <code className="font-mono">{shortHash(v.head ?? "")}</code></>
        ) : (
          <>Chain broken at event <span className="tabular">{v.broken_at}</span>: {v.reason}</>
        )}
      </span>
      <Button variant="outline" size="sm" onClick={() => verify.refetch()} disabled={verify.isFetching}>
        <RotateCw className={cn("size-3.5", verify.isFetching && "animate-spin")} aria-hidden />
        Re-verify
      </Button>
    </div>
  );
}

function ActionBreakdown({ entries }: { entries: AuditEntry[] }) {
  const counts = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of entries) by.set(e.action, (by.get(e.action) ?? 0) + 1);
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  if (counts.length === 0) return null;
  const max = counts[0][1];
  const top = counts[0];
  return (
    <Section title="Events by action" description="Real counts from the audit log loaded above.">
      <ul
        className="space-y-1.5"
        aria-label={`Event counts by action: ${counts.map(([a, n]) => `${a} ${n}`).join(", ")}`}
      >
        {counts.map(([action, n]) => (
          <li key={action} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate font-mono text-xs text-ink-2" title={action}>{action}</span>
            <span className="h-3 flex-1 bg-sunken">
              <span className="block h-full bg-signal" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-xs tabular text-ink">{n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-ink-2">
        <span className="font-mono tabular text-ink">{top[0]}</span> is the most logged action, {top[1]} of {entries.length} events ({Math.round((top[1] / entries.length) * 100)}%).
      </p>
    </Section>
  );
}

export default function Audit() {
  const audit = useQuery(q.audit());
  return (
    <div className="space-y-6">
      <PageHeader brand title="Audit" description="Every case decision and news/media action, hash-chained so a change to history is detectable." />
      <VerifyBanner />
      {audit.data && <ActionBreakdown entries={audit.data} />}
      <Section title="Events">
        {audit.error ? <ErrorState error={audit.error} what="the audit log" /> : (
          <DataTable<AuditEntry>
            columns={columns}
            data={audit.data ?? []}
            loading={audit.isPending}
            searchPlaceholder="Search actor, action or target"
            initialSorting={[{ id: "at", desc: true }]}
            emptyTitle="No audit events yet"
            emptyHint="Decisions on cases, and news or media actions, are logged here as they happen."
          />
        )}
      </Section>
    </div>
  );
}
