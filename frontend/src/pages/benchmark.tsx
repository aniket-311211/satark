import { useQuery } from "@tanstack/react-query";
import { RecallChart } from "@/components/benchmark/recall-chart";
import { MethodLine, SystemsTable } from "@/components/benchmark/systems-table";
import { ThresholdSweepChart } from "@/components/benchmark/threshold-chart";
import { RealCasesTable, SatarkMisses } from "@/components/benchmark/real-cases";
import { ErrorState, LoadingBlock, PageHeader, Panel, Section } from "@/components/satark/page";
import { q } from "@/lib/api";

export default function Benchmark() {
  const report = useQuery(q.evalReport());
  const real = useQuery(q.evalReal());

  return (
    <div className="space-y-5">
      <PageHeader brand title="Benchmark" description="How the matcher performs on synthetic variants and on real labelled cases drawn from live data." />

      {report.error ? <ErrorState error={report.error} what="the benchmark report" /> : !report.data ? <LoadingBlock rows={3} /> : (
        <>
          <Panel label="Method">
            <MethodLine report={report.data} />
          </Panel>

          <Panel label="Matching systems" meta="Satark marked with a weight and an amber marker">
            <SystemsTable report={report.data} />
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel label="F1 by threshold" meta="Sweep 50–99, three systems">
              <ThresholdSweepChart report={report.data} />
            </Panel>
            <Panel label="Recall by query type" meta="Satark vs RapidFuzz">
              <RecallChart report={report.data} />
            </Panel>
          </div>

          <Panel label="Satark misses" meta="Held-out test set, dev-picked threshold">
            <SatarkMisses report={report.data} />
          </Panel>
        </>
      )}

      <Section className="border-t border-rule pt-5" title="Real labelled cases" description="34 cases drawn from live LSE LEI, Companies House and NSE data, not synthetic transforms.">
        {real.error ? <ErrorState error={real.error} what="real labelled cases" /> : !real.data ? <LoadingBlock rows={5} /> : <RealCasesTable evalReal={real.data} />}
      </Section>
    </div>
  );
}
