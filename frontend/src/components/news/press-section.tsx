import { EmptyState } from "@/components/satark/page";
import type { NewsItem } from "@/lib/types";
import { DeskSection } from "./desk-section";

/** The business press as front-page sections, one desk per publisher, largest first (up to five across). */
export function PressSection({ items }: { items: NewsItem[] }) {
  const byPublisher = new Map<string, NewsItem[]>();
  for (const item of items) byPublisher.set(item.publisher, [...(byPublisher.get(item.publisher) ?? []), item]);
  const desks = [...byPublisher.entries()].sort(([, a], [, b]) => b.length - a.length).slice(0, 5);
  if (desks.length === 0) return <EmptyState title="No press articles loaded" />;
  return <DeskSection desks={desks} tone="text-ink" columns="lg:grid-cols-5" />;
}
