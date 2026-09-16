export type Band = "strong" | "probable" | "possible" | "weak";

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
}

export interface ScreenResult {
  query: string;
  normalized: string;
  kind: string;
  notes: string[];
  matches: Match[];
  candidates_scored: number;
  latency_ms: number;
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
}

export interface Customer {
  id: number;
  name: string;
  kind: string;
  birth_date: string;
  country: string;
  segment: string;
  synthetic: boolean;
  created_at: string | null;
  last_screened_at: string | null;
  open_alerts?: number;
}

export interface Alert {
  id: number;
  score: number;
  band: Band;
  matched_name: string;
  reasons: string[];
  components: Record<string, number>;
  trigger: string;
  status: "open" | "confirmed" | "discarded" | "escalated";
  decided_by: string;
  note: string;
  created_at: string | null;
  decided_at: string | null;
  customer: Customer | null;
  entity: Entity | null;
}

export interface Stats {
  entities: number;
  indexed_names: number;
  customers: number;
  alerts_by_status: Record<string, number>;
  alerts_by_trigger: Record<string, number>;
  alert_threshold: number;
  bus: string;
  stream_lag: number;
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
  last_run: { mode: string; total: number; added: number; changed: number; removed: number; at: string } | null;
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
  checks: Record<string, boolean>;
  extractor: string;
}

export interface MediaBrief {
  subject: string;
  cached: boolean;
  extractor: string | null;
  trace: string[];
  errors: string[];
  headlines_read: number | null;
  events: MediaEvent[];
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  at: string;
}

export interface SystemMetrics {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  top1_accuracy: number;
  per_transform: Record<string, number>;
  latency_ms?: { p50: number; p95: number; max: number };
}

export interface EvalReport {
  generated_at: string;
  watchlist_entities: number;
  indexed_names: number;
  method: string;
  cases: { total: number; dev: number; test: number; by_type: Record<string, number> };
  systems: Record<string, SystemMetrics>;
  sweeps: Record<string, { threshold: number; precision: number; recall: number; f1: number }[]>;
  satark_misses: { query: string; expected: string; transform: string; top_score: number | null }[];
}

export interface DeltaResult {
  entity_id: string;
  listed_name: string;
  style: string;
  seeded_from: string;
  event_id: string;
  bus: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  stats: () => request<Stats>("/stats"),
  screen: (body: { name: string; kind?: string; birth_date?: string; limit?: number }) => post<ScreenResult>("/screen", body),
  entity: (id: string) => request<Entity>(`/entities/${encodeURIComponent(id)}`),
  alerts: (status?: string) => request<{ total: number; items: Alert[] }>(`/alerts?limit=200${status ? `&status=${status}` : ""}`),
  decide: (id: number, decision: string, note: string) => post<Alert>(`/alerts/${id}/decision`, { decision, note, actor: "analyst" }),
  customers: (q: string, offset = 0) => request<{ total: number; items: Customer[] }>(`/customers?q=${encodeURIComponent(q)}&limit=50&offset=${offset}`),
  onboard: (body: { name: string; kind: string; birth_date: string }) =>
    post<{ customer: Customer; alerts: Alert[]; screening: ScreenResult }>("/customers", body),
  watchlists: () => request<Watchlist[]>("/watchlists"),
  refresh: () => post<unknown>("/watchlists/refresh?mode=remote", {}),
  simulateDelta: (style?: string) => post<DeltaResult>("/watchlists/simulate-delta", { style: style || null }),
  media: (subject: string, refresh: boolean) => post<MediaBrief>("/media/brief", { subject, refresh }),
  audit: () => request<AuditEntry[]>("/audit?limit=150"),
  evaluation: () => request<EvalReport>("/eval"),
};
