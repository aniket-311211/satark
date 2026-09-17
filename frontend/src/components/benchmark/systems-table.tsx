import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInt, pct } from "@/lib/format";
import type { EvalReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const SYSTEM_LABEL = { exact: "Exact match", rapidfuzz: "RapidFuzz (token_sort_ratio)", satark: "Satark" } as const;
const SYSTEMS = ["exact", "rapidfuzz", "satark"] as const;

/** report.method plus the dev/test split sizes: how the numbers below were produced. */
export function MethodLine({ report }: { report: EvalReport }) {
  return (
    <p className="max-w-[72ch] text-[15px] leading-relaxed text-ink-2">
      {report.method} <span className="text-ink">{fmtInt(report.cases.total)}</span> synthetic queries in total:{" "}
      <span className="text-ink">{fmtInt(report.cases.dev)}</span> to pick each system's threshold,{" "}
      <span className="text-ink">{fmtInt(report.cases.test)}</span> held out for the numbers below.
    </p>
  );
}

export function SystemsTable({ report }: { report: EvalReport }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule bg-surface">
      <Table className="tabular">
        <TableHeader>
          <TableRow className="border-rule hover:bg-transparent">
            <TableHead className="text-xs font-medium text-ink-2">System</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Threshold</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Precision</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Recall</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">F1</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Unlisted people flagged</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Top-1 accuracy</TableHead>
            <TableHead className="text-right text-xs font-medium text-ink-2">Latency p50 / p95 (ms)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SYSTEMS.map((key) => {
            const s = report.systems[key];
            const satark = key === "satark";
            return (
              <TableRow key={key} className={cn("border-rule", satark && "font-medium")}>
                <TableCell className="py-3 text-ink">{SYSTEM_LABEL[key]}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{s.threshold}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{pct(s.precision)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{pct(s.recall)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{s.f1.toFixed(3)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{pct(s.false_positive_rate)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{pct(s.top1_accuracy)}</TableCell>
                <TableCell className="py-3 text-right font-mono text-ink">{s.latency_ms ? `${s.latency_ms.p50.toFixed(1)} / ${s.latency_ms.p95.toFixed(1)}` : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
