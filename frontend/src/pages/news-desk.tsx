import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ErrorState, LoadingBlock, Section } from "@/components/satark/page";
import { Nameplate, Ticker } from "@/components/news/masthead";
import { FrontPageGrid } from "@/components/news/front-page";
import { RegulatorColumns } from "@/components/news/regulator-columns";
import { PressSection } from "@/components/news/press-section";
import { Coverage } from "@/components/news/coverage";
import { Dossier, useQuickPicks } from "@/components/news/dossier";
import { SearchWire } from "@/components/news/search-wire";
import { Sources } from "@/components/news/sources";
import { groupByCategory, isRisk } from "@/components/news/lib";
import { q } from "@/lib/api";

export default function NewsDesk() {
  const regulator = useQuery(q.news("regulator"));
  const press = useQuery(q.news("publisher"));
  const feeds = useQuery(q.feeds());
  const quickPicks = useQuickPicks();

  const regulatorItems = useMemo(() => regulator.data ?? [], [regulator.data]);
  const pressItems = useMemo(() => press.data ?? [], [press.data]);
  const riskItems = useMemo(() => [...regulatorItems, ...pressItems].filter(isRisk), [regulatorItems, pressItems]);
  const riskGroups = useMemo(() => groupByCategory(riskItems), [riskItems]);

  const feedList = feeds.data ?? [];
  const articlesIndexed = feedList.reduce((n, f) => n + f.articles, 0);
  const regulatorTotal = feedList.filter((f) => f.kind === "regulator").reduce((n, f) => n + f.articles, 0);
  const pressTotal = feedList.filter((f) => f.kind === "publisher").reduce((n, f) => n + f.articles, 0);
  const feedsOk = feedList.filter((f) => f.status === "ok" || f.status === "not modified").length;
  const lastPoll = feedList.reduce<string | null>((latest, f) => (f.polled_at && (!latest || f.polled_at > latest) ? f.polled_at : latest), null);

  const loading = regulator.isPending || press.isPending;
  const error = regulator.error ?? press.error;

  // The dossier sits below the front page, regulator columns, press section and coverage strip, all of
  // which load asynchronously and push it down. Scroll to it only once that content has settled, so
  // `?subject=` lands on the dossier instead of wherever it happened to be when the page was still short.
  const [params] = useSearchParams();
  const settled = !regulator.isPending && !press.isPending && !feeds.isPending;
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !settled) return;
    scrolledRef.current = true;
    if (params.get("subject")?.trim()) document.getElementById("dossier")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [settled, params]);

  return (
    <div className="space-y-10">
      <Nameplate
        articlesIndexed={articlesIndexed}
        regulatorCount={regulatorTotal}
        riskCount={riskItems.length}
        feedsOk={feedsOk}
        feedsTotal={feedList.length}
        lastPoll={lastPoll}
      />
      <Ticker items={regulatorItems} />

      {error ? (
        <ErrorState error={error} what="the news wire" />
      ) : loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          <FrontPageGrid regulatorItems={regulatorItems} riskItems={riskItems} />

          <Section className="border-t border-rule pt-8" title="Regulator wires" description="SEBI, RBI, FCA and NCA, newest order first.">
            <RegulatorColumns items={regulatorItems} />
          </Section>

          <Section className="border-t border-rule pt-8" title="Press" description="The business press feeds, newest headline first.">
            <PressSection items={pressItems} />
          </Section>

          <Section className="border-t border-rule pt-8" title="Coverage analytics" description="What the tracked feeds actually carry, not a trend — the database holds one seeding day.">
            <Coverage feeds={feedList} regulatorTotal={regulatorTotal} pressTotal={pressTotal} riskGroups={riskGroups} />
          </Section>
        </>
      )}

      <Section className="border-t border-rule pt-8" title="Screen a name in the news" description="Run a name and see only the events whose quote and subject actually appear in the source.">
        <Dossier quickPicks={quickPicks} />
      </Section>

      <Section className="border-t border-rule pt-8" title="Search the wire" description="Full text, not just headlines.">
        <SearchWire />
      </Section>

      <Section className="border-t border-rule pt-8" title="Sources" description="Feed health behind the wire and the dossier.">
        <Sources />
      </Section>
    </div>
  );
}
