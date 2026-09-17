import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import { RotateCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/satark/data-table";
import { ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { q } from "@/lib/api";
import { fmtInt, fmtTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const shortHash = (h: string) => h.slice(0, 8);

function detailText(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" · ");
}

function TargetCell({ target }: { target: string }) {
  const [kind, idStr] = target.split(":");
  const id = Number(idStr);
  if (kind === "case" && Number.isFinite(id)) return <Link to={`/cases/${id}`} className="text-signal underline">{target}</Link>;
  if (kind === "customer" && Number.isFinite(id)) return <Link to={`/customers/${id}`} className="text-signal underline">{target}</Link>;
  return <span className="text-ink">{target}</span>;
}

const columns: ColumnDef<AuditEntry>[] = [
  { id: "at", accessorKey: "at", header: "Time", sortDescFirst: true,
    cell: ({ getValue }) => <span className="whitespace-nowrap tabular text-ink-2">{fmtTime(getValue<string>())}</span> },
  { id: "actor", accessorKey: "actor", header: "Actor", cell: ({ getValue }) => <span className="text-ink">{getValue<string>()}</span> },
  { id: "action", accessorKey: "action", header: "Action", cell: ({ getValue }) => <span className="font-mono text-xs text-ink">{getValue<string>()}</span> },
  { id: "target", accessorKey: "target", header: "Target", cell: ({ getValue }) => <TargetCell target={getValue<string>()} /> },
  { id: "detail", accessorFn: (r) => detailText(r.detail), header: "Detail", enableSorting: false,
    cell: ({ getValue }) => (
      <span className="block max-w-[34ch] truncate font-mono text-xs text-ink-2" title={getValue<string>()}>{getValue<string>() || "—"}</span>
    ) },
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
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        v.ok ? "border-cleared/30 bg-cleared-soft text-cleared" : "border-strong/30 bg-strong-soft font-medium text-strong",
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

export default function Audit() {
  const audit = useQuery(q.audit());
  return (
    <div className="space-y-6">
      <PageHeader title="Audit trail" description="Every case decision and news/media action, hash-chained so a change to history is detectable." />
      <VerifyBanner />
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
