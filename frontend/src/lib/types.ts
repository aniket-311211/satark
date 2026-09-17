export type Band = "strong" | "probable" | "possible" | "weak";
export type Verdict = "contradicted" | "confirmed" | "inconclusive";
export type CheckResult = "supports" | "contradicts" | "neutral" | "no_data";
export type ListKey = "in_nse_debarred" | "in_sansad" | "in_mha_banned" | "un_sc_sanctions" | "gb_fcdo_sanctions";

export interface EvidenceCheck {
  check: "date_of_birth" | "nationality" | "pep_term_age";
  customer: string;
  listed: string;
  result: CheckResult;
  strength: "strong" | "weak";
  detail: string;
}
export interface Secondary {
  verdict?: Verdict;
  summary?: string;
  checks?: EvidenceCheck[];
}
export interface Pair {
  query: string;
  listed: string;
  how: "exact" | "phonetic" | "initial" | "spelling";
  sim: number;
}
export interface Match {
  entity_id: string;
  entity_name: string;
  matched_name: string;
  source: string;
  dataset: string;
  schema: string;
  score: number;
  band: Band;
  components: Record<string, number>;
  pairs: Pair[];
  reasons: string[];
  status: "active" | "historical";
  secondary: Secondary;
}
export interface ScreenResult {
  query: string;
  normalized: string;
  kind: "person" | "org";
  notes: string[];
  matches: Match[];
  candidates_scored: number;
  latency_ms: number;
}
export interface Order {
  date?: string;
  end_date?: string;
  authority?: string;
  duration?: string;
  description?: string;
  source_url?: string;
  program?: string;
  status?: "active" | "revoked" | "expired";
}
export interface Term {
  post?: string;
  start?: string;
  end?: string;
  status?: string;
}
export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  schema: string;
  source: string;
  source_label: string;
  category: string;
  authority: string;
  birth_date: string;
  countries: string;
  sanctions: string;
  program: string;
  dataset: string;
  first_seen: string;
  last_change: string;
  active: boolean;
  status: "active" | "historical";
  details: { orders?: Order[]; terms?: Term[]; relatives?: { name: string; relationship?: string }[] };
}
export interface EntityRow extends Entity {
  /** Alerts this listing has raised against the book, any status. */
  alerts: number;
}
export interface ExposureMatch {
  customer: Customer;
  score: number;
  band: Band;
  reasons: string[];
  listed_as: string;
  above_threshold: boolean;
  secondary: Secondary;
  alert: { id: number; status: AlertStatus; case_id: number | null } | null;
}
export interface Exposure {
  entity: Entity;
  threshold: number;
  matches: ExposureMatch[];
}
export interface ImportReport {
  dry_run: boolean;
  valid: number;
  rejected: number;
  errors: { line: number; name: string; reason: string }[];
  preview: { line: number; name: string; kind: "person" | "org"; birth_date: string; country: string; nationality: string }[];
  added?: number;
  updated?: number;
  screened?: number;
  alerts?: number;
  auto_cleared?: number;
  hits?: { customer: Customer; alerts: number; auto_cleared: number; case_id: number | null }[];
}
export interface ParentRef {
  lei: string;
  name: string;
  country: string;
}
export interface CustomerDetails {
  lei?: string;
  legal_name?: string;
  other_names?: string[];
  category?: string;
  entity_status?: string;
  registration_status?: string;
  managing_lou?: string;
  registered_as?: string;
  jurisdiction?: string;
  city?: string;
  direct_parent?: ParentRef | null;
  ultimate_parent?: ParentRef | null;
  gleif_url?: string;
  list_entity_id?: string;
  company_number?: string;
  company_status?: string;
  psc?: { kind: string; name: string; natures_of_control: string[] }[];
  psc_statements?: string[];
  ownership_conflict?: { conflict: boolean; reason: string };
  groups?: string[];
  nationality?: string;
  occupation?: string;
  appointments?: { company_number: string; company_name: string; officer_role: string; appointed_on: string }[];
}
export interface Customer {
  id: number;
  name: string;
  kind: "person" | "org";
  birth_date: string;
  country: string;
  segment: string;
  synthetic: boolean;
  external_id: string | null;
  group: "A" | "B" | "C" | "";
  parent_id: number | null;
  details: CustomerDetails;
  created_at: string | null;
  last_screened_at: string | null;
  open_alerts?: number;
}
export type AlertStatus = "open" | "confirmed" | "discarded" | "auto_cleared";
export interface Alert {
  id: number;
  case_id: number | null;
  entity_id: string;
  score: number;
  band: Band;
  matched_name: string;
  reasons: string[];
  components: Record<string, number>;
  secondary: Secondary;
  trigger: string;
  status: AlertStatus;
  decided_by: string;
  note: string;
  created_at: string | null;
  decided_at: string | null;
  customer: Customer | null;
  entity: Entity | null;
}
export type CaseStatus = "open" | "pending_approval" | "closed";
export interface Case {
  id: number;
  customer_id: number;
  status: CaseStatus;
  proposed_decision: "" | "confirmed" | "discarded";
  proposed_by: string;
  proposed_note: string;
  proposed_at: string | null;
  decision: "" | "confirmed" | "discarded";
  decided_by: string;
  decided_note: string;
  decided_at: string | null;
  created_at: string | null;
}
export interface CaseRow extends Case {
  customer: Customer | null;
  alerts: number;
  top_score: number;
  top_band: Band | "";
  verdicts: Record<string, number>;
  lists: string[];
}
export interface AuditTrailEntry {
  id: number;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
  at: string;
  hash: string;
}
export interface CaseDetail extends Case {
  customer: Customer | null;
  parent: Customer | null;
  alerts: Alert[];
  audit: AuditTrailEntry[];
}
export interface CustomerProfile extends Customer {
  parent: Customer | null;
  children: Customer[];
  cases: Case[];
}
export interface Stats {
  entities: number;
  indexed_names: number;
  customers: number;
  customers_by_group: Record<string, number>;
  alert_outcomes: { group: string; status: AlertStatus; verdict: Verdict | "unchecked"; count: number }[];
  alerts_by_status: Record<string, number>;
  alerts_by_trigger: Record<string, number>;
  cases_by_status: Record<string, number>;
  alert_threshold: number;
  bus: string;
  database: string;
  index_built_at: string | null;
  llm_enabled: boolean;
}
export interface Watchlist {
  key: string;
  label: string;
  category: string;
  authority: string;
  entities: number;
  active: number;
  historical: number;
  last_run: { mode: string; total: number; added: number; changed: number; removed: number; at: string } | null;
}
export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  at: string;
}
export interface AuditVerify {
  ok: boolean;
  events: number;
  head?: string;
  broken_at?: number | null;
  reason?: string;
}
export interface EvalSystem {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  top1_accuracy: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  per_transform: Record<string, number>;
  latency_ms?: { p50: number; p95: number; max: number };
}
export interface EvalReport {
  generated_at: string;
  watchlist_entities: number;
  indexed_names: number;
  cases: { total: number; dev: number; test: number; by_type: Record<string, number> };
  method: string;
  systems: Record<"exact" | "rapidfuzz" | "satark", EvalSystem>;
  sweeps: Record<"exact" | "rapidfuzz" | "satark", { threshold: number; precision: number; recall: number; f1: number }[]>;
  satark_misses: { query: string; expected: string; transform: string; top_score: number | null }[];
}
export interface RealCase {
  query: string;
  kind: string;
  entity_id: string;
  expected: "match" | "no_match";
  origin: string;
  note: string;
  score: number;
  passed: boolean;
}
export interface RealEval {
  cases: number;
  passed: number;
  threshold: number;
  results: RealCase[];
}
export interface NewsItem {
  url: string;
  title: string;
  summary: string;
  publisher: string;
  kind: "regulator" | "publisher";
  country: string;
  published: string;
  fetched_at: string;
  /** Adverse-media keyword category, or null when the story carries no risk signal. */
  category: string | null;
}
export interface NewsArticle {
  title: string;
  url: string;
  publisher: string;
  published: string;
  text: string;
  category: string | null;
}
export interface FeedStatus {
  name: string;
  url: string;
  kind: "regulator" | "publisher";
  country: string;
  articles: number;
  polled_at: string | null;
  status: string;
}
export interface MediaEvent {
  id: number;
  subject: string;
  category: string;
  headline: string;
  summary: string;
  quote: string;
  url: string;
  publisher: string;
  published_at: string;
  verified: boolean;
  checks: { quote_in_source?: boolean; subject_in_source?: boolean; extractor_says_subject?: boolean; category_known?: boolean };
  extractor: string;
}
export interface MediaBrief {
  subject: string;
  cached: boolean;
  extractor: string;
  trace: string[];
  errors: string[];
  headlines_read: number | null;
  events: MediaEvent[];
}
export interface User {
  id: string;
  role: "analyst" | "reviewer";
}
export interface Paged<T> {
  total: number;
  items: T[];
}
