import { EmptyState } from "@/components/satark/page";
import { fmtDate, fmtInt, titleCase } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { byNewest } from "./lib";

/** Publisher columns, 3–5 across on desktop, top headlines each; a category-tagged story shows its mark. */
export function PressSection({ items }: { items: NewsItem[] }) {
  const byPublisher = new Map<string, NewsItem[]>();
  for (const item of items) {
    const list = byPublisher.get(item.publisher) ?? [];
    list.push(item);
    byPublisher.set(item.publisher, list);
  }
  const publishers = [...byPublisher.entries()].sort(([, a], [, b]) => b.length - a.length);
  for (const [, list] of publishers) list.sort(byNewest);

  if (publishers.length === 0) return <EmptyState title="No press articles loaded" />;

  return (
    <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {publishers.map(([name, list]) => (
        <div key={name} className="bg-panel p-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-rule pb-2">
            <h3 className="label-caps text-ink-2">{name}</h3>
            <span className="font-mono text-[11px] text-ink-3">{fmtInt(list.length)}</span>
          </div>
          <ul className="mt-1">
            {list.slice(0, 6).map((item) => (
              <li key={item.url} className="border-b border-rule py-2 last:border-b-0">
                <a href={item.url} target="_blank" rel="noreferrer" className="block text-[13px] leading-snug text-ink hover:text-signal">{item.title}</a>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
                  <span>{fmtDate(item.published)}</span>
                  {item.category && <span className="label-caps border border-rule-strong px-1 py-0.5">{titleCase(item.category)}</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
