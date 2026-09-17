import { ListTag } from "@/components/satark/badges";
import { fmtInt } from "@/lib/format";
import type { Watchlist } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The five lists as selectors: choosing one filters the listings below. Bars use the line form, active full height, historical half. */
export function ListSelector({ lists, value, onChange }: { lists: Watchlist[]; value: string; onChange: (key: string) => void }) {
  const total = lists.reduce((n, l) => n + l.entities, 0);
  const max = Math.max(1, ...lists.map((l) => l.entities));
  const options = [{ key: "", label: "All lists", entities: total, active: lists.reduce((n, l) => n + l.active, 0), historical: lists.reduce((n, l) => n + l.historical, 0) }, ...lists];
  return (
    <div role="radiogroup" aria-label="Filter listings by list" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {options.map((l) => {
        const selected = value === l.key;
        return (
          <button key={l.key || "all"} type="button" role="radio" aria-checked={selected} onClick={() => onChange(l.key)}
            className={cn("flex min-w-0 cursor-pointer flex-col gap-2 border bg-panel p-3 text-left transition-colors duration-150",
              selected ? "border-amber" : "border-rule hover:border-rule-strong")}>
            <span className="flex min-w-0 items-center gap-2">
              {l.key ? <ListTag source={l.key} /> : <span className="label-caps text-ink-2">All</span>}
              <span className="truncate text-[12.5px] text-ink-2">{l.key ? l.label : "Every list"}</span>
            </span>
            <span className="font-mono text-lg leading-none text-ink">{fmtInt(l.entities)}</span>
            <span className="flex h-2 w-full items-end border-b border-rule" aria-hidden>
              <span className="h-full bg-signal" style={{ width: `${(l.active / (l.key ? max : total || 1)) * 100}%` }} />
              <span className="h-1/2 bg-ink-3" style={{ width: `${(l.historical / (l.key ? max : total || 1)) * 100}%` }} />
            </span>
            <span className="text-[11.5px] text-ink-3"><span className="font-mono text-ink-2">{fmtInt(l.active)}</span> active · <span className="font-mono">{fmtInt(l.historical)}</span> historical</span>
          </button>
        );
      })}
    </div>
  );
}
