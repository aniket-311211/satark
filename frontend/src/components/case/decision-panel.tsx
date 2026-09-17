import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, useCaseActions } from "@/lib/api";
import { DEMO_USERS, useIdentity } from "@/lib/identity";
import { fmtTime } from "@/lib/format";
import type { CaseDetail } from "@/lib/types";

const DECISION_LABEL = { confirmed: "Confirm true match", discarded: "Discard as false positive" } as const;
const MIN_NOTE = 10;

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <p role="alert" className="flex items-start gap-2 text-[13px] text-strong">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}.{forbidden && " Switch identity in the sidebar to act as someone else."}</span>
    </p>
  );
}

/** Maker-checker: an analyst proposes with a rationale; a reviewer who didn't propose approves or rejects. */
export function DecisionPanel({ detail }: { detail: CaseDetail }) {
  const { user } = useIdentity();
  const role = DEMO_USERS.find((u) => u.id === user)?.role;
  const { propose, review } = useCaseActions(detail.id);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A finished action changes the case status; move focus to the heading that now describes it.
  const lastStatus = useRef(detail.status);
  useEffect(() => {
    if (lastStatus.current !== detail.status) headingRef.current?.focus();
    lastStatus.current = detail.status;
    setNote("");
    setTouched(false);
  }, [detail.status]);

  const busy = propose.isPending || review.isPending;
  const tooShort = note.trim().length < MIN_NOTE;

  if (detail.status === "closed") {
    return (
      <section aria-labelledby="decision-heading" className="space-y-2 rounded-xl border border-rule bg-surface p-4">
        <h2 id="decision-heading" ref={headingRef} tabIndex={-1} className="text-lg text-ink">Decision</h2>
        <p className="text-sm text-ink">
          {detail.decision === "confirmed" ? "Confirmed as a true match" : "Discarded as a false positive"}
        </p>
        <p className="text-[13px] text-ink-2">Proposed by {detail.proposed_by || "—"}, approved by {detail.decided_by} · {fmtTime(detail.decided_at)}</p>
        {detail.decided_note && <p className="text-[13px] text-ink-2">Reviewer note: {detail.decided_note}</p>}
      </section>
    );
  }

  const noteField = (id: string, label: string, required: boolean) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] text-ink">{label}</Label>
      <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => setTouched(true)} rows={3}
        aria-invalid={required && touched && tooShort} aria-describedby={`${id}-hint`}
        className="rounded-lg border-rule-strong bg-surface text-sm" />
      <p id={`${id}-hint`} className={required && touched && tooShort ? "text-[12px] text-strong" : "text-[12px] text-ink-2"}>
        {required ? `A rationale of at least ${MIN_NOTE} characters goes into the audit trail (${note.trim().length}/${MIN_NOTE}).` : "Optional. Recorded in the audit trail."}
      </p>
    </div>
  );

  if (detail.status === "open") {
    const submit = (decision: keyof typeof DECISION_LABEL) => {
      setTouched(true);
      if (tooShort) return;
      propose.mutate({ decision, note: note.trim() });
    };
    return (
      <section aria-labelledby="decision-heading" className="space-y-3 rounded-xl border border-rule bg-surface p-4">
        <div>
          <h2 id="decision-heading" ref={headingRef} tabIndex={-1} className="text-lg text-ink">Propose a decision</h2>
          <p className="text-[13px] text-ink-2">A different reviewer has to approve it before the case closes.</p>
        </div>
        {noteField("proposal-note", "Rationale", true)}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => submit("confirmed")} disabled={busy} aria-busy={propose.isPending && propose.variables?.decision === "confirmed"}>
            {propose.isPending && propose.variables?.decision === "confirmed" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {DECISION_LABEL.confirmed}
          </Button>
          <Button variant="outline" onClick={() => submit("discarded")} disabled={busy} aria-busy={propose.isPending && propose.variables?.decision === "discarded"}>
            {propose.isPending && propose.variables?.decision === "discarded" ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
            {DECISION_LABEL.discarded}
          </Button>
        </div>
        <ErrorLine error={propose.error} />
      </section>
    );
  }

  // pending_approval
  const isProposer = user === detail.proposed_by;
  const canReview = role === "reviewer" && !isProposer;
  const blocked = isProposer
    ? "You proposed this decision. The four-eyes rule needs a different reviewer: switch identity in the sidebar."
    : role !== "reviewer" ? "Only a reviewer can approve or reject. Switch identity in the sidebar to act as a reviewer." : "";
  const decided = detail.proposed_decision === "confirmed" || detail.proposed_decision === "discarded" ? detail.proposed_decision : null;

  return (
    <section aria-labelledby="decision-heading" className="space-y-3 rounded-xl border border-rule bg-surface p-4">
      <div>
        <h2 id="decision-heading" ref={headingRef} tabIndex={-1} className="text-lg text-ink">Review the proposal</h2>
        <p className="mt-1 text-sm text-ink">{decided ? DECISION_LABEL[decided] : "—"}</p>
        <p className="text-[13px] text-ink-2">Proposed by {detail.proposed_by} · {fmtTime(detail.proposed_at)}</p>
        {detail.proposed_note && <blockquote className="mt-2 border-l border-rule-strong pl-3 text-[13px] text-ink">{detail.proposed_note}</blockquote>}
      </div>
      {blocked ? (
        <p className="text-[13px] text-ink-2">{blocked}</p>
      ) : (
        <>
          {noteField("review-note", "Reviewer note", false)}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => review.mutate({ approve: true, note: note.trim() })} disabled={busy || !canReview}>
              {review.isPending && review.variables?.approve ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              Approve and close
            </Button>
            <Button variant="outline" onClick={() => review.mutate({ approve: false, note: note.trim() })} disabled={busy || !canReview}>
              {review.isPending && review.variables && !review.variables.approve ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
              Reject and reopen
            </Button>
          </div>
        </>
      )}
      <ErrorLine error={review.error} />
    </section>
  );
}
