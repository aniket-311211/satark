import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { actingAs } from "./identity";
import type {
  AuditEntry, AuditVerify, CaseDetail, CaseRow, Customer, CustomerProfile, Entity, EntityRow, EvalReport, Exposure, FeedStatus,
  ImportReport, MediaBrief, NewsArticle, NewsItem, Paged, RealEval, ScreenResult, Stats, User, Watchlist, Alert,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Satark-User": actingAs(), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const q = {
  stats: () => queryOptions({ queryKey: ["stats"], queryFn: () => request<Stats>("/stats") }),
  watchlists: () => queryOptions({ queryKey: ["watchlists"], queryFn: () => request<Watchlist[]>("/watchlists") }),
  cases: (status = "") => queryOptions({ queryKey: ["cases", status], queryFn: () => request<Paged<CaseRow>>(`/cases?${qs({ status, limit: 200 })}`) }),
  case: (id: number) => queryOptions({ queryKey: ["case", id], queryFn: () => request<CaseDetail>(`/cases/${id}`) }),
  alerts: (status = "") => queryOptions({ queryKey: ["alerts", status], queryFn: () => request<Paged<Alert>>(`/alerts?${qs({ status, limit: 500 })}`) }),
  customers: (params: { group?: string; kind?: string } = {}) =>
    queryOptions({ queryKey: ["customers", params], queryFn: () => request<Paged<Customer>>(`/customers?${qs({ ...params, limit: 2000 })}`) }),
  customer: (id: number) => queryOptions({ queryKey: ["customer", id], queryFn: () => request<CustomerProfile>(`/customers/${id}`) }),
  entity: (id: string) => queryOptions({ queryKey: ["entity", id], queryFn: () => request<Entity>(`/entities/${encodeURIComponent(id)}`) }),
  entities: (params: { q?: string; source?: string; status?: string; kind?: string; offset?: number }) =>
    queryOptions({
      queryKey: ["entities", params],
      queryFn: () => request<Paged<EntityRow>>(`/entities?${qs({ ...params, limit: 50 })}`),
      placeholderData: (previous) => previous,
    }),
  exposure: (id: string) => queryOptions({ queryKey: ["exposure", id], queryFn: () => request<Exposure>(`/entities/${encodeURIComponent(id)}/exposure`) }),
  audit: () => queryOptions({ queryKey: ["audit"], queryFn: () => request<AuditEntry[]>("/audit?limit=500") }),
  auditVerify: () => queryOptions({ queryKey: ["audit", "verify"], queryFn: () => request<AuditVerify>("/audit/verify") }),
  evalReport: () => queryOptions({ queryKey: ["eval"], queryFn: () => request<EvalReport>("/eval"), staleTime: Infinity }),
  evalReal: () => queryOptions({ queryKey: ["eval", "real"], queryFn: () => request<RealEval>("/eval/real"), staleTime: Infinity }),
  news: (kind = "") => queryOptions({ queryKey: ["news", kind], queryFn: () => request<NewsItem[]>(`/news?${qs({ kind, limit: 300 })}`) }),
  newsSearch: (term: string) =>
    queryOptions({ queryKey: ["news", "search", term], queryFn: () => request<NewsArticle[]>(`/news/search?${qs({ q: term, limit: 40 })}`), enabled: term.trim().length >= 2 }),
  feeds: () => queryOptions({ queryKey: ["news", "feeds"], queryFn: () => request<FeedStatus[]>("/news/feeds") }),
  users: () => queryOptions({ queryKey: ["users"], queryFn: () => request<User[]>("/users"), staleTime: Infinity }),
};

export const api = {
  screen: (body: { name: string; kind?: "person" | "org" | null; birth_date?: string; nationality?: string; country?: string; limit?: number; min_score?: number }) =>
    post<ScreenResult>("/screen", body),
  mediaBrief: (subject: string, refresh = false) => post<MediaBrief>("/media/brief", { subject, refresh }),
  pollNews: () => post<{ name: string; status: string; new: number; total: number }[]>("/news/poll"),
  importCustomers: (csv: string, dryRun: boolean) => post<ImportReport>("/customers/import", { csv, dry_run: dryRun }),
};

export const IMPORT_TEMPLATE_URL = "/api/customers/import/template";

export function useCaseActions(caseId: number) {
  const client = useQueryClient();
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["case", caseId] }), client.invalidateQueries({ queryKey: ["cases"] }),
    client.invalidateQueries({ queryKey: ["stats"] }), client.invalidateQueries({ queryKey: ["audit"] })]);
  return {
    propose: useMutation({
      mutationFn: (body: { decision: "confirmed" | "discarded"; note: string }) => post(`/cases/${caseId}/proposal`, body),
      onSuccess: refresh,
    }),
    review: useMutation({
      mutationFn: (body: { approve: boolean; note: string }) => post(`/cases/${caseId}/review`, body),
      onSuccess: refresh,
    }),
  };
}
