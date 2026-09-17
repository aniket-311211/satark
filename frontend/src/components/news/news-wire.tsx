import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/satark/page";
import { q } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtDate, fmtInt } from "@/lib/format";
import type { NewsArticle, NewsItem } from "@/lib/types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wrap every occurrence of any search term, case-insensitively, in <mark>. */
function highlightTerms(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    terms.some((t) => t.toLowerCase() === part.toLowerCase())
      ? <mark key={i} className="rounded bg-cleared-soft px-0.5 text-ink">{part}</mark>
      : part,
  );
}

function groupByDay(items: NewsItem[]): [string, NewsItem[]][] {
  const map = new Map<string, NewsItem[]>();
  for (const item of items) {
    const day = fmtDate(item.fetched_at);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return [...map.entries()];
}

function RecentList({ items, narrow }: { items: NewsItem[]; narrow: boolean }) {
  if (items.length === 0) return <EmptyState title="No articles yet">Poll the feeds below to bring in the first items.</EmptyState>;
  return (
    <div className="space-y-5">
      {groupByDay(items).map(([day, dayItems]) => (
        <div key={day}>
          <h3 className="text-xs font-medium tracking-wide text-ink-2 uppercase">{day}</h3>
          <ul className="mt-1.5 divide-y divide-rule border-t border-rule">
            {dayItems.map((item) => (
              <li key={item.url} className={cn("grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 py-2.5", narrow ? "sm:grid-cols-[3.5rem_minmax(0,1fr)]" : "sm:grid-cols-[10rem_minmax(0,1fr)]")}>
                <span className={item.kind === "regulator" ? "text-xs font-medium tracking-wide text-signal uppercase" : "text-xs text-ink-2"}>{item.publisher}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-sm text-ink [overflow-wrap:anywhere] hover:text-signal">{item.title}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SearchResults({ term, results, loading }: { term: string; results?: NewsArticle[]; loading: boolean }) {
  const terms = term.trim().split(/\s+/).filter(Boolean);
  if (loading) return <LoadingBlock rows={4} />;
  if (!results || results.length === 0) return <EmptyState title={`No articles match "${term}"`}>Search looks at the full article text, not just the headline.</EmptyState>;
  return (
    <ul className="divide-y divide-rule border-t border-rule">
      {results.map((a) => (
        <li key={a.url} className="py-2.5">
          <a href={a.url} target="_blank" rel="noreferrer" className="block text-sm text-ink [overflow-wrap:anywhere] hover:text-signal">{highlightTerms(a.title, terms)}</a>
          <p className="mt-1 text-xs text-ink-2">{a.publisher} · {fmtDate(a.published)}</p>
          <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{highlightTerms(a.text, terms)}</p>
        </li>
      ))}
    </ul>
  );
}

const DEFAULT_VISIBLE = 40;
const KINDS = [{ value: "regulator", label: "Regulator actions" }, { value: "publisher", label: "Press" }, { value: "all", label: "Everything" }] as const;

export function NewsWire() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("regulator");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const recent = useQuery(q.news(kind === "all" ? "" : kind));
  const search = useQuery(q.newsSearch(debounced));
  const searching = debounced.trim().length >= 2;
  const all = useMemo(() => recent.data ?? [], [recent.data]);
  const items = showAll ? all : all.slice(0, DEFAULT_VISIBLE);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="news-search">Search full text</Label>
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input id="news-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. sanctions, insider trading"
            className="h-9 rounded-sm border-rule-strong bg-surface pl-9" />
        </label>
      </div>
      {!searching && (
        <ToggleGroup type="single" value={kind} onValueChange={(v) => { if (v) { setKind(v as typeof kind); setShowAll(false); } }} variant="outline" size="sm" aria-label="Which feeds to show">
          {KINDS.map((k) => <ToggleGroupItem key={k.value} value={k.value}>{k.label}</ToggleGroupItem>)}
        </ToggleGroup>
      )}
      </div>

      <div className="mt-5">
        {searching ? (
          <SearchResults term={debounced} results={search.data} loading={search.isPending} />
        ) : recent.error ? (
          <ErrorState error={recent.error} what="the news wire" />
        ) : recent.isPending ? (
          <LoadingBlock rows={5} />
        ) : (
          <>
            <RecentList items={items} narrow={kind === "regulator"} />
            {!showAll && all.length > DEFAULT_VISIBLE && (
              <button type="button" onClick={() => setShowAll(true)}
                className="mt-4 cursor-pointer text-sm text-signal underline underline-offset-4 hover:decoration-2">
                Show all {fmtInt(all.length)} articles
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
