import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/satark/page";
import { Num, Takeaway } from "@/components/overview/shared";
import { q } from "@/lib/api";
import { fmtInt, titleCase } from "@/lib/format";

/** Where the owned index stands: regulator versus press reach, and which stories carry an adverse-media tag. */
export function NewsPulse() {
  const feeds = useQuery(q.feeds());
  // Same two windows the News desk loads, so both screens count the same tagged stories.
  const regulatorNews = useQuery(q.news("regulator"));
  const pressNews = useQuery(q.news("publisher"));
  const error = feeds.error ?? regulatorNews.error ?? pressNews.error;
  if (error) return <ErrorState error={error} what="news pulse" />;
  if (!feeds.data || !regulatorNews.data || !pressNews.data) return <LoadingBlock rows={4} />;

  const regulator = feeds.data.filter((f) => f.kind === "regulator").reduce((n, f) => n + f.articles, 0);
  const publisher = feeds.data.filter((f) => f.kind === "publisher").reduce((n, f) => n + f.articles, 0);
  const total = regulator + publisher || 1;

  const loaded = [...regulatorNews.data, ...pressNews.data];
  const tagged = loaded.filter((n) => n.category);
  const byCategory = new Map<string, number>();
  for (const n of tagged) byCategory.set(n.category!, (byCategory.get(n.category!) ?? 0) + 1);
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden bg-sunken"
        role="img"
        aria-label={`News reach: ${fmtInt(regulator)} regulator articles, ${fmtInt(publisher)} press articles`}
      >
        <div className="h-full bg-violet" style={{ width: `${(regulator / total) * 100}%` }} />
        <div className="h-full bg-signal" style={{ width: `${(publisher / total) * 100}%` }} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <li className="text-violet"><Num className="text-violet">{fmtInt(regulator)}</Num> regulator</li>
        <li className="text-signal"><Num className="text-signal">{fmtInt(publisher)}</Num> press</li>
      </ul>

      {categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Risk-tagged stories by category">
          {categories.map(([cat, count]) => (
            <li key={cat} className="border border-rule-strong px-1.5 py-0.5 text-[11px] text-ink">
              {titleCase(cat)} <Num className="text-ink-2">{fmtInt(count)}</Num>
            </li>
          ))}
        </ul>
      )}

      <Takeaway>
        {fmtInt(total)} articles indexed across {feeds.data.length} feeds, {fmtInt(regulator)} regulator and {fmtInt(publisher)} press. Of the {fmtInt(loaded.length)} most
        recent, {fmtInt(tagged.length)} carry a risk tag{categories[0] && <> — mostly {titleCase(categories[0][0])}</>}.
      </Takeaway>
      <Link to="/news" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-signal underline decoration-rule-strong underline-offset-4 hover:decoration-signal">
        Open the News desk <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
