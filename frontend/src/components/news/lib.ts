import type { NewsItem } from "@/lib/types";

/** Strip whatever HTML a source feed embedded in a summary, and collapse the whitespace that leaves behind. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** A clean standfirst: several feeds repeat the headline verbatim at the start of the summary, so drop that repeat. */
export function standfirst(title: string, summary: string): string {
  const clean = stripHtml(summary);
  const prefix = title.trim();
  if (clean.toLowerCase().startsWith(prefix.toLowerCase())) {
    return clean.slice(prefix.length).replace(/^[.\s]+/, "");
  }
  return clean;
}

/**
 * Best available timestamp for sorting "newest first". A few regulator feeds (SEBI, FCA) publish
 * non-ISO date strings `Date` can't parse, so this falls back to when the wire indexed the story —
 * sorting never breaks on an unparseable value. Display still reads the raw `published` field.
 */
export function timeOf(item: Pick<NewsItem, "published" | "fetched_at">): number {
  const published = new Date(item.published).getTime();
  return Number.isFinite(published) ? published : new Date(item.fetched_at).getTime();
}

export const byNewest = (a: NewsItem, b: NewsItem) => timeOf(b) - timeOf(a);

export const isRisk = (item: NewsItem) => item.category !== null;

/** Risk-tagged items grouped by category: each group newest first, groups ranked by size. */
export function groupByCategory(items: NewsItem[]): [string, NewsItem[]][] {
  const map = new Map<string, NewsItem[]>();
  for (const item of items) {
    if (!item.category) continue;
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  for (const list of map.values()) list.sort(byNewest);
  return [...map.entries()].sort(([, a], [, b]) => b.length - a.length);
}
