import { fmtDate, fmtInt, titleCase } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { byNewest } from "./lib";

const REGULATORS = ["SEBI", "RBI", "FCA", "NCA"] as const;

function Headline({ item, weighty }: { item: NewsItem; weighty: boolean }) {
  return (
    <li className="border-b border-rule py-2 last:border-b-0">
      <a href={item.url} target="_blank" rel="noreferrer" className={cn("block leading-snug text-ink hover:text-signal", weighty ? "text-[15px]" : "text-[13px]")}>
        {item.title}
      </a>
      <p className="mt-1 text-[11px] text-ink-2">
        {fmtDate(item.published)}
        {item.category && <> · {titleCase(item.category)}</>}
      </p>
    </li>
  );
}

/** SEBI | RBI | FCA | NCA side by side, top 5 headlines each, newest first, first item weightier. */
export function RegulatorColumns({ items }: { items: NewsItem[] }) {
  return (
    <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
      {REGULATORS.map((name) => {
        const list = items.filter((i) => i.publisher === name).sort(byNewest);
        return (
          <div key={name} className="bg-panel p-3">
            <div className="flex items-baseline justify-between gap-2 border-b border-rule pb-2">
              <h3 className="label-caps text-violet">{name}</h3>
              <span className="font-mono text-[11px] text-ink-3">{fmtInt(list.length)}</span>
            </div>
            {list.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-3">No items loaded.</p>
            ) : (
              <ul className="mt-1">
                {list.slice(0, 5).map((item, i) => <Headline key={item.url} item={item} weighty={i === 0} />)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
