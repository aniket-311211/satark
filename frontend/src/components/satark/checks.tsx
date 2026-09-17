import { ArrowRight } from "lucide-react";
import { BandBadge, CheckResultMark, VerdictBadge } from "@/components/satark/badges";
import { ScoreMeter } from "@/components/satark/score";
import { CHECK_LABEL } from "@/lib/format";
import type { Band, Pair, Secondary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AlignRow {
  customer: string | null;
  listed: string | null;
  kind: string;
  text: string;
}

const KIND_LABEL: Record<string, string> = {
  exact: "Exact", phonetic: "Phonetic", spelling: "Spelling variant", initial: "Initial",
  extra: "Listed extra", ignored: "Ignored suffix", honorific: "Honorific dropped", missing: "Not on list",
};
const HOW_KIND: Record<Pair["how"], string> = { exact: "exact", phonetic: "phonetic", initial: "initial", spelling: "spelling" };

/** Reasons come as sentences, each naming the token(s) it judged. Parsed into rows; anything unrecognised still shows as a note. */
function rowsFromReasons(reasons: string[]): AlignRow[] {
  const patterns: [RegExp, (m: RegExpMatchArray) => Omit<AlignRow, "text">][] = [
    [/^'(.+)' matches exactly$/, (m) => ({ customer: m[1], listed: m[1], kind: "exact" })],
    [/^'(.+)' sounds like '(.+)'$/, (m) => ({ customer: m[1], listed: m[2], kind: "phonetic" })],
    [/^'(.+)' is a spelling variant of '(.+)'$/, (m) => ({ customer: m[1], listed: m[2], kind: "spelling" })],
    [/^'(.+)' fits listed initial '(.+)'$/, (m) => ({ customer: m[1], listed: m[2], kind: "initial" })],
    [/^initial '(.+)' fits '(.+)'$/, (m) => ({ customer: m[2], listed: m[1], kind: "initial" })],
    [/^list name also has: (.+)$/, (m) => ({ customer: null, listed: m[1], kind: "extra" })],
    [/^list name ignored legal suffix '(.+)'$/, (m) => ({ customer: null, listed: m[1], kind: "ignored" })],
    [/^list name removed honorific '(.+)'$/, (m) => ({ customer: null, listed: m[1], kind: "honorific" })],
    [/^list name removed .*'(.+)'.*$/, (m) => ({ customer: null, listed: m[1], kind: "ignored" })],
    [/^not on list name: (.+)$/, (m) => ({ customer: m[1], listed: null, kind: "missing" })],
  ];
  return reasons.map((text) => {
    for (const [re, build] of patterns) {
      const m = text.match(re);
      if (m) return { ...build(m), text };
    }
    return { customer: null, listed: null, kind: "note", text };
  });
}

function rowsFromPairs(pairs: Pair[]): AlignRow[] {
  return pairs.map((p) => ({ customer: p.query, listed: p.listed, kind: HOW_KIND[p.how], text: `${Math.round(p.sim * 100)} similarity` }));
}

function AlignmentList({ rows }: { rows: AlignRow[] }) {
  return (
    <ul className="mt-3 divide-y divide-rule/70 border-t border-rule" aria-label="Token alignment">
      {rows.map((r, i) => (
        <li key={i} className="py-2 text-[13px]">
          {r.customer || r.listed ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-ink">{r.customer ?? "—"}</span>
              <span aria-hidden className="h-px w-6 shrink-0 bg-rule-strong sm:w-10" />
              <span className="font-mono text-xs text-ink">{r.listed ?? "—"}</span>
              <span className="label-caps text-ink-3">{KIND_LABEL[r.kind] ?? r.kind}</span>
            </div>
          ) : null}
          <p className={cn("text-ink-2 [overflow-wrap:anywhere]", (r.customer || r.listed) && "mt-0.5")}>
            {!(r.customer || r.listed) && <span aria-hidden className="text-ink-3">· </span>}
            {r.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

const COMPONENT_LABEL: Record<string, string> = {
  name_similarity: "Name similarity", token_set: "Token set", query_coverage: "Query coverage", list_coverage: "List coverage",
};

/** Check 1: how the names compare. A pure name score; dates of birth and nationality are judged separately. */
export function NameMatchPanel({ score, band, matchedName, customerName, reasons, pairs, components, threshold = 80, className }: {
  score: number;
  band: Band;
  matchedName: string;
  customerName?: string;
  reasons: string[];
  pairs?: Pair[];
  /** Aggregate score components (e.g. an alert's name-match breakdown); shown as context under the meter. */
  components?: Record<string, number>;
  threshold?: number;
  className?: string;
}) {
  const rows = pairs && pairs.length > 0 ? rowsFromPairs(pairs) : rowsFromReasons(reasons);
  return (
    <section aria-labelledby="check-name" className={cn("min-w-0 rounded-sm border border-rule bg-surface p-4 md:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="check-name" className="text-base text-ink">Check 1 · Name match</h3>
        <BandBadge band={band} />
      </div>
      <ScoreMeter score={score} band={band} threshold={threshold} className="mt-4" />
      <p className="mt-1.5 text-xs text-ink-2">Alerts start at {threshold}. The tick marks the threshold.</p>
      {components && (
        <p className="mt-2 font-mono text-[11px] tabular text-ink-3">
          {Object.entries(components).map(([k, v], i) => (
            <span key={k}>{i > 0 && " · "}{COMPONENT_LABEL[k] ?? k} {(v * 100).toFixed(1)}</span>
          ))}
        </p>
      )}
      <p className="mt-4 text-sm text-ink [overflow-wrap:anywhere]">
        {customerName && <><span className="text-ink-2">Customer</span> {customerName} <ArrowRight className="mx-1 inline size-3.5 text-ink-3" aria-label="compared with" /></>}
        <span className="text-ink-2">listed as</span> {matchedName}
      </p>
      {rows.length > 0 && <AlignmentList rows={rows} />}
    </section>
  );
}

/** Check 2: independent attributes that support, contradict or can't speak to the name match. */
export function IdentityEvidencePanel({ secondary, className }: { secondary?: Secondary; className?: string }) {
  const checks = secondary?.checks ?? [];
  return (
    <section aria-labelledby="check-identity" className={cn("min-w-0 rounded-sm border border-rule bg-surface p-4 md:p-5", className)}>
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
                <td className={cn("py-2 pr-3 text-[13px] whitespace-nowrap text-ink", /^\d/.test(c.customer ?? "") && "font-mono text-xs")}>{c.customer || "—"}</td>
                <td className={cn("py-2 pr-3 text-[13px] text-ink [overflow-wrap:break-word]", /^\d/.test(c.listed ?? "") && "font-mono text-xs")}>{c.listed || "—"}</td>
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
