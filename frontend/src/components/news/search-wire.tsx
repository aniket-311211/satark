import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingBlock } from "@/components/satark/page";
import { q } from "@/lib/api";
import { Dateline } from "./dateline";
import type { NewsArticle } from "@/lib/types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wrap every occurrence of any search term, case-insensitively, in <mark>. */
function highlightTerms(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    terms.some((t) => t.toLowerCase() === part.toLowerCase())
      ? <mark key={i} className="bg-amber-soft px-0.5 text-ink">{part}</mark>
      : part,
  );
}

/** Full-text search across the wire: reads article bodies, not just headlines. */
export function SearchWire() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);
  const search = useQuery(q.newsSearch(debounced));
  const searching = debounced.trim().length >= 2;
  const terms = debounced.trim().split(/\s+/).filter(Boolean);

  return (
    <div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wire-search">Search the full article text</Label>
        <label className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input id="wire-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. sanctions, insider trading"
            className="h-9 border-rule-strong bg-panel pl-9" />
        </label>
      </div>

      <div className="mt-4">
        {!searching ? (
          <p className="text-[13px] text-ink-3">Type at least two characters to search headlines and article text together.</p>
        ) : search.isPending ? (
          <LoadingBlock rows={4} />
        ) : !search.data || search.data.length === 0 ? (
          <EmptyState title={`No articles match "${debounced}"`}>Search looks at the full article text, not just the headline.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {search.data.map((a: NewsArticle) => (
              <li key={a.url} className="py-3">
                <a href={a.url} target="_blank" rel="noreferrer" className="block text-[14px] text-ink [overflow-wrap:anywhere] hover:text-signal">
                  {highlightTerms(a.title, terms)}
                </a>
                <p className="mt-1 text-xs text-ink-2">{a.publisher} · <Dateline published={a.published} fetchedAt="" /></p>
                <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{highlightTerms(a.text, terms)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
