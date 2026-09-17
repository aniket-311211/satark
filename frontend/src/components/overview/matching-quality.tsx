import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { EvalSystem } from "@/lib/types";

const SYSTEMS: { key: "exact" | "rapidfuzz" | "satark"; label: string; bar: string }[] = [
  { key: "exact", label: "Exact", bar: "bg-ink-3" },
  { key: "rapidfuzz", label: "RapidFuzz", bar: "bg-ink-2" },
  { key: "satark", label: "Satark", bar: "bg-signal" },
];
const METRICS: { key: keyof EvalSystem; label: string }[] = [
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
];

/** Precision, recall and F1 for all three systems at each one's own best threshold, plus the real-case gate. */
export function MatchingQuality() {
  const report = useQuery(q.evalReport());
  const real = useQuery(q.evalReal());
  if (report.error) return <ErrorState error={report.error} what="the benchmark report" />;
  if (!report.data) return <LoadingBlock rows={4} />;

  const allPass = real.data && real.data.passed === real.data.cases;

  return (
    <div>
      <div
        className="space-y-3"
        role="group"
        aria-label={SYSTEMS.map((s) => {
          const sys = report.data.systems[s.key];
          return `${s.label}: precision ${sys.precision.toFixed(3)}, recall ${sys.recall.toFixed(3)}, F1 ${sys.f1.toFixed(3)}`;
        }).join("; ")}
      >
        {SYSTEMS.map((s) => {
          const sys = report.data.systems[s.key];
          return (
            <div key={s.key}>
              <p className="text-[12.5px] text-ink">{s.label} <span className="text-ink-3">· threshold {sys.threshold}</span></p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {METRICS.map((m) => (
                  <div key={m.key}>
                    <div className="h-1.5 w-full bg-sunken" aria-hidden>
                      <div className={`h-full ${s.bar}`} style={{ width: `${(sys[m.key] as number) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-ink-3">{m.label} <Num className="text-ink-2">{(sys[m.key] as number).toFixed(3)}</Num></p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Takeaway>
        At its own threshold, Satark's F1 is <Num>{report.data.systems.satark.f1.toFixed(3)}</Num> against RapidFuzz's <Num>{report.data.systems.rapidfuzz.f1.toFixed(3)}</Num> and
        exact match's <Num>{report.data.systems.exact.f1.toFixed(3)}</Num>, on the held-out half of {fmtInt(report.data.cases.total)} synthetic queries.
      </Takeaway>
      {real.data && (
        <Link to="/benchmark" className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-signal underline decoration-rule-strong underline-offset-4 hover:decoration-signal">
          {allPass ? <CircleCheck className="size-4 text-cleared" aria-hidden /> : <CircleAlert className="size-4 text-strong" aria-hidden />}
          <Num className="text-signal">{real.data.passed}</Num> of <Num className="text-signal">{real.data.cases}</Num> real labelled cases pass
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
