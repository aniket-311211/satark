import { Panel, PageHeader } from "@/components/satark/page";
import { Ticker } from "@/components/overview/ticker";
import { OpenCases } from "@/components/overview/open-cases";
import { ScreeningFunnel } from "@/components/overview/funnel";
import { IdentityEvidence } from "@/components/overview/identity-evidence";
import { ScoreHistogram } from "@/components/overview/score-histogram";
import { GroupListHeatmap } from "@/components/overview/heatmap";
import { WatchlistBoard } from "@/components/overview/watchlist-board";
import { MatchingQuality } from "@/components/overview/matching-quality";
import { NewsPulse } from "@/components/overview/news-pulse";

export default function Overview() {
  return (
    <div>
      <PageHeader title="Overview" description="The book right now: what's screened, what's open, and what the evidence says. Every figure below is live." />

      <div className="grid grid-cols-12 gap-3">
        <div className="order-4 col-span-12 md:order-none">
          <Ticker />
        </div>

        <Panel label="Open cases" className="order-1 col-span-12 md:order-none md:col-span-4">
          <OpenCases />
        </Panel>
        <Panel label="Screening funnel" className="order-2 col-span-12 md:order-none md:col-span-5">
          <ScreeningFunnel />
        </Panel>
        <Panel label="Identity evidence" className="order-3 col-span-12 md:order-none md:col-span-3">
          <IdentityEvidence />
        </Panel>

        <Panel label="Alert score histogram" className="order-5 col-span-12 md:col-span-6">
          <ScoreHistogram />
        </Panel>
        <Panel label="Group × list heatmap" className="order-6 col-span-12 md:col-span-6">
          <GroupListHeatmap />
        </Panel>

        <Panel label="Watchlist board" className="order-7 col-span-12 md:col-span-4">
          <WatchlistBoard />
        </Panel>
        <Panel label="Matching quality" className="order-8 col-span-12 md:col-span-4">
          <MatchingQuality />
        </Panel>
        <Panel label="News pulse" className="order-9 col-span-12 md:col-span-4">
          <NewsPulse />
        </Panel>
      </div>
    </div>
  );
}
