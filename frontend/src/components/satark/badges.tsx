import { Check, CircleDashed, Fingerprint, Minus, ShieldCheck, SignalHigh, SignalLow, SignalMedium, X, type LucideIcon } from "lucide-react";
import { ALERT_STATUS_LABEL, BAND_LABEL, CASE_STATUS_LABEL, GROUPS, LISTS, RESULT_LABEL, VERDICT_LABEL } from "@/lib/format";
import type { AlertStatus, Band, CaseStatus, CheckResult, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const chip = "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium leading-none";

const BAND_STYLE: Record<Band, { icon: LucideIcon; className: string }> = {
  strong: { icon: SignalHigh, className: "bg-strong-soft text-strong" },
  probable: { icon: SignalMedium, className: "bg-probable-soft text-probable" },
  possible: { icon: SignalLow, className: "bg-possible-soft text-possible" },
  weak: { icon: SignalLow, className: "bg-sunken text-ink-2" },
};

export function BandBadge({ band, className }: { band: Band | ""; className?: string }) {
  if (!band) return <span className="text-ink-3">—</span>;
  const { icon: Icon, className: tone } = BAND_STYLE[band];
  return (
    <span className={cn(chip, tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {BAND_LABEL[band]}
    </span>
  );
}

const VERDICT_STYLE: Record<Verdict, { icon: LucideIcon; className: string }> = {
  contradicted: { icon: ShieldCheck, className: "bg-cleared-soft text-cleared" },
  confirmed: { icon: Fingerprint, className: "bg-strong-soft text-strong" },
  inconclusive: { icon: CircleDashed, className: "bg-sunken text-ink-2" },
};

export function VerdictBadge({ verdict, className }: { verdict?: Verdict | "unchecked"; className?: string }) {
  if (!verdict || verdict === "unchecked") return <span className={cn(chip, "bg-sunken text-ink-3", className)}>Not checked</span>;
  const { icon: Icon, className: tone } = VERDICT_STYLE[verdict];
  return (
    <span className={cn(chip, tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

const RESULT_ICON: Record<CheckResult, LucideIcon> = { supports: Check, contradicts: X, neutral: Minus, no_data: CircleDashed };
const RESULT_TONE: Record<CheckResult, string> = {
  supports: "text-ink",
  contradicts: "text-cleared",
  neutral: "text-ink-2",
  no_data: "text-ink-3",
};

export function CheckResultMark({ result }: { result: CheckResult }) {
  const Icon = RESULT_ICON[result];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", RESULT_TONE[result])}>
      <Icon className="size-3.5" aria-hidden />
      {RESULT_LABEL[result]}
    </span>
  );
}

const CASE_TONE: Record<CaseStatus, string> = {
  open: "border border-rule-strong text-ink",
  pending_approval: "bg-signal-soft text-signal",
  closed: "bg-sunken text-ink-2",
};
export const CaseStatusBadge = ({ status }: { status: CaseStatus }) => <span className={cn(chip, CASE_TONE[status])}>{CASE_STATUS_LABEL[status]}</span>;

const ALERT_TONE: Record<AlertStatus, string> = {
  open: "border border-rule-strong text-ink",
  confirmed: "bg-strong-soft text-strong",
  discarded: "bg-sunken text-ink-2",
  auto_cleared: "bg-cleared-soft text-cleared",
};
export const AlertStatusBadge = ({ status }: { status: AlertStatus }) => <span className={cn(chip, ALERT_TONE[status])}>{ALERT_STATUS_LABEL[status]}</span>;

export function ListTag({ source, className }: { source: string; className?: string }) {
  const list = LISTS[source];
  return (
    <span className={cn(chip, "border border-rule-strong bg-surface text-ink", className)} title={list?.authority}>
      {list?.short ?? source}
    </span>
  );
}

export function GroupTag({ group, withLabel = true }: { group: string; withLabel?: boolean }) {
  if (!group) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-2" title={GROUPS[group]?.long}>
      <span className="grid size-5 place-items-center rounded-full bg-ink font-mono text-[11px] text-surface">{group}</span>
      {withLabel && GROUPS[group]?.label}
    </span>
  );
}
