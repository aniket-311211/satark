import { Link } from "react-router";
import { fmtTime } from "@/lib/format";
import type { AuditTrailEntry } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = { "case.proposed": "Proposed", "case.approved": "Approved", "case.rejected": "Rejected" };
const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;

function detailLine(entry: AuditTrailEntry) {
  const d = entry.detail as Record<string, string | undefined>;
  const decision = d.decision ?? d.rejected_decision;
  return [decision && (decision === "confirmed" ? "true match" : "false positive"), d.note].filter(Boolean).join(" · ");
}

/** This case's events in the hash-chained log: each hash covers the event and the one before it. */
export function CaseAudit({ entries }: { entries: AuditTrailEntry[] }) {
  return (
    <section aria-labelledby="case-audit-heading" className="space-y-3">
      <div>
        <h2 id="case-audit-heading" className="text-lg text-ink">Audit trail</h2>
        <p className="text-[13px] text-ink-2">
          Each hash seals the event and the event before it. <Link to="/audit" className="text-signal underline">Verify the whole chain</Link>.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-ink-2">No decisions yet. The first proposal starts this case's trail.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-rule pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-ink" aria-hidden />
              <p className="text-sm text-ink">
                {ACTION_LABEL[entry.action] ?? entry.action} <span className="text-ink-2">by {entry.actor}</span>
              </p>
              {detailLine(entry) && <p className="text-[13px] text-ink-2 [overflow-wrap:anywhere]">{detailLine(entry)}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
                <span className="tabular">{fmtTime(entry.at)}</span>
                <code className="rounded-full border border-rule px-2 py-0.5 font-mono text-[11px] text-ink" title={entry.hash}>{shortHash(entry.hash)}</code>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
