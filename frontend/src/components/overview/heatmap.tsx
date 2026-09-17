import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt, GROUPS, LISTS } from "@/lib/format";

const LIST_KEYS = Object.keys(LISTS);
const GROUP_KEYS = Object.keys(GROUPS);

/** Where alerts actually land: which customer group, on which list. A quiet cell is a real zero, not a gap. */
export function GroupListHeatmap() {
  const stats = useQuery(q.stats());
  const alerts = useQuery(q.alerts());
  if (stats.error || alerts.error) return <ErrorState error={stats.error ?? alerts.error} what="the group by list matrix" />;
  if (!stats.data || !alerts.data) return <LoadingBlock rows={4} />;

  const cell: Record<string, Record<string, number>> = {};
  for (const g of GROUP_KEYS) cell[g] = Object.fromEntries(LIST_KEYS.map((l) => [l, 0]));
  for (const a of alerts.data.items) {
    const g = a.customer?.group;
    const list = a.entity_id.split(":")[0];
    if (g && cell[g] && list in cell[g]) cell[g][list] += 1;
  }
  const rowTotal = (g: string) => LIST_KEYS.reduce((n, l) => n + cell[g][l], 0);
  const colTotal = (l: string) => GROUP_KEYS.reduce((n, g) => n + cell[g][l], 0);
  const grandTotal = GROUP_KEYS.reduce((n, g) => n + rowTotal(g), 0) || 1;
  const max = Math.max(1, ...GROUP_KEYS.flatMap((g) => LIST_KEYS.map((l) => cell[g][l])));

  const busiest = [...GROUP_KEYS].sort((a, b) => rowTotal(b) - rowTotal(a))[0];
  const quiet = GROUP_KEYS.filter((g) => rowTotal(g) === 0);

  return (
    <div>
      <p className="mb-1.5 text-right text-[11.5px] text-ink-3 sm:hidden" aria-hidden>Swipe for every list and totals →</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[12.5px]" aria-label="Alert count by customer group and watchlist">
          <caption className="sr-only">Alert counts for each customer group against each of the five watchlists, with row and column totals.</caption>
          <thead>
            <tr>
              <th scope="col" className="label-caps border border-rule bg-panel px-2 py-1.5 text-left font-medium text-ink-3">Group</th>
              {LIST_KEYS.map((l) => (
                <th key={l} scope="col" className="label-caps border border-rule bg-panel px-2 py-1.5 text-right font-medium text-ink-3">{LISTS[l].short}</th>
              ))}
              <th scope="col" className="label-caps border border-rule bg-panel px-2 py-1.5 text-right font-medium text-ink-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_KEYS.map((g) => (
              <tr key={g}>
                <th scope="row" className="border border-rule px-2 py-1.5 text-left font-normal text-ink">
                  {g} <span className="text-ink-3">· {fmtInt(stats.data.customers_by_group[g] ?? 0)} customers</span>
                </th>
                {LIST_KEYS.map((l) => {
                  const v = cell[g][l];
                  const pct = v === 0 ? 0 : (v / max) * 100;
                  return (
                    <td
                      key={l}
                      className="border border-rule px-2 py-1.5 text-right font-mono tabular"
                      style={v > 0 ? { backgroundColor: `color-mix(in oklab, var(--band-strong) ${pct}%, var(--panel))` } : undefined}
                    >
                      <span className={v > 0 ? "text-ink" : "text-ink-3"}>{fmtInt(v)}</span>
                    </td>
                  );
                })}
                <td className="border border-rule bg-panel px-2 py-1.5 text-right font-mono tabular text-ink">{fmtInt(rowTotal(g))}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="border border-rule bg-panel px-2 py-1.5 text-left font-medium text-ink-3">Total</th>
              {LIST_KEYS.map((l) => (
                <td key={l} className="border border-rule bg-panel px-2 py-1.5 text-right font-mono tabular text-ink">{fmtInt(colTotal(l))}</td>
              ))}
              <td className="border border-rule bg-panel px-2 py-1.5 text-right font-mono tabular text-ink">{fmtInt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Takeaway>
        Group {busiest} carries the most alerts ({fmtInt(rowTotal(busiest))} of {fmtInt(grandTotal)}), nearly all on {LISTS[[...LIST_KEYS].sort((a, b) => colTotal(b) - colTotal(a))[0]].short}
        {quiet.length > 0 && <> — group{quiet.length > 1 ? "s" : ""} {quiet.join(" and ")} raised none</>}.
      </Takeaway>
    </div>
  );
}
