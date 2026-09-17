import { ArrowRight } from "lucide-react";
import { BandBadge, CheckResultMark, VerdictBadge } from "@/components/satark/badges";
import { ScoreMeter } from "@/components/satark/score";
import { CHECK_LABEL } from "@/lib/format";
import type { Band, Pair, Secondary } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOW: Record<Pair["how"], string> = { exact: "exact", phonetic: "sounds alike", initial: "initial", spelling: "spelling variant" };

/** Check 1: how the names compare. A pure name score; dates of birth and nationality are judged separately. */
export function NameMatchPanel({ score, band, matchedName, customerName, reasons, pairs, threshold = 80, className }: {
  score: number;
  band: Band;
  matchedName: string;
  customerName?: string;
  reasons: string[];
  pairs?: Pair[];
  threshold?: number;
  className?: string;
}) {
  return (
    <section aria-labelledby="check-name" className={cn("min-w-0 rounded-xl border border-rule bg-surface p-4 md:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="check-name" className="text-base text-ink">Check 1 · Name match</h3>
        <BandBadge band={band} />
      </div>
      <ScoreMeter score={score} band={band} threshold={threshold} className="mt-4" />
      <p className="mt-1.5 text-xs text-ink-2">Alerts start at {threshold}. The tick marks the threshold.</p>
      <p className="mt-4 text-sm text-ink [overflow-wrap:anywhere]">
        {customerName && <><span className="text-ink-2">Customer</span> {customerName} <ArrowRight className="mx-1 inline size-3.5 text-ink-3" aria-label="compared with" /></>}
        <span className="text-ink-2">listed as</span> {matchedName}
      </p>
      {pairs && pairs.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Token alignment">
          {pairs.map((p, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 font-mono text-xs text-ink">
              {p.query}
              <ArrowRight className="size-3 text-ink-3" aria-hidden />
              {p.listed}
              <span className="font-sans text-[11px] text-ink-2">{HOW[p.how]} · {Math.round(p.sim * 100)}</span>
            </li>
          ))}
        </ul>
      )}
      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
          {reasons.map((r, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-ink-3">·</span>{r}</li>)}
        </ul>
      )}
    </section>
  );
}

/** Check 2: independent attributes that support, contradict or can't speak to the name match. */
export function IdentityEvidencePanel({ secondary, className }: { secondary?: Secondary; className?: string }) {
  const checks = secondary?.checks ?? [];
  return (
    <section aria-labelledby="check-identity" className={cn("min-w-0 rounded-xl border border-rule bg-surface p-4 md:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="check-identity" className="text-base text-ink">Check 2 · Identity evidence</h3>
        <VerdictBadge verdict={secondary?.verdict ?? "unchecked"} />
      </div>
      <p className="mt-4 text-sm text-ink">{secondary?.summary ?? "Not checked: supply a date of birth, nationality or country to compare."}</p>
      {checks.length > 0 && (
        <table className="mt-4 w-full text-left text-[13px] tabular">
          <caption className="sr-only">Identity checks</caption>
          <thead>
            <tr className="border-b border-rule text-xs text-ink-2">
              <th scope="col" className="py-1.5 pr-3 font-medium">Check</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Customer</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Listed</th>
              <th scope="col" className="py-1.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.check} className="border-b border-rule/70 align-top last:border-0">
                <th scope="row" className="py-2 pr-3 font-normal text-ink">
                  {CHECK_LABEL[c.check] ?? c.check}
                  <span className="block text-[11px] text-ink-3">{c.strength === "strong" ? "decisive" : "supporting only"}</span>
                </th>
                <td className="py-2 pr-3 font-mono text-xs text-ink [overflow-wrap:anywhere]">{c.customer || "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs text-ink [overflow-wrap:anywhere]">{c.listed || "—"}</td>
                <td className="py-2">
                  <CheckResultMark result={c.result} />
                  <span className="mt-0.5 block text-[11px] text-ink-2">{c.detail}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
