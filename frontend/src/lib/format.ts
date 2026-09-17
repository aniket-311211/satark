import type { AlertStatus, Band, CaseStatus, CheckResult, Verdict } from "./types";

export const LISTS: Record<string, { short: string; label: string; authority: string }> = {
  in_nse_debarred: { short: "NSE", label: "NSE debarred", authority: "National Stock Exchange of India / SEBI orders" },
  in_sansad: { short: "Parliament", label: "Parliament of India", authority: "Lok Sabha & Rajya Sabha" },
  in_mha_banned: { short: "MHA", label: "MHA banned organisations", authority: "Ministry of Home Affairs (UAPA)" },
  un_sc_sanctions: { short: "UN", label: "UN Security Council", authority: "United Nations Security Council" },
  gb_fcdo_sanctions: { short: "UK", label: "UK Sanctions List", authority: "Foreign, Commonwealth & Development Office" },
};
export const listShort = (key: string) => LISTS[key]?.short ?? key;

export const GROUPS: Record<string, { label: string; long: string }> = {
  A: { label: "LSE-issued LEI", long: "Indian entities whose LEI is issued by London Stock Exchange LEI Ltd" },
  B: { label: "UK subsidiary", long: "UK companies with an Indian parent, and their directors (Companies House)" },
  C: { label: "Debarred LEI holder", long: "Companies on NSE's active debarment list that hold an LEI" },
  D: { label: "Uploaded", long: "Customers an analyst imported from their own file" },
};

export const BAND_LABEL: Record<Band, string> = { strong: "Strong", probable: "Probable", possible: "Possible", weak: "Weak" };
export const VERDICT_LABEL: Record<Verdict, string> = {
  contradicted: "Cleared by evidence",
  confirmed: "Identity agrees",
  inconclusive: "No decisive evidence",
};
export const CHECK_LABEL: Record<string, string> = { date_of_birth: "Date of birth", nationality: "Nationality", pep_term_age: "Term age" };
export const RESULT_LABEL: Record<CheckResult, string> = { supports: "Supports", contradicts: "Contradicts", neutral: "Neutral", no_data: "No data" };
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = { open: "Open", pending_approval: "Awaiting review", closed: "Closed" };
export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  open: "Open",
  confirmed: "Confirmed match",
  discarded: "False positive",
  auto_cleared: "Auto-cleared",
};

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
};
export const fmtTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : timeFmt.format(d);
};
export const fmtInt = (n?: number | null) => (n ?? 0).toLocaleString("en-IN");
export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
