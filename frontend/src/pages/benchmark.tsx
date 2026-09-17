import { useQuery } from "@tanstack/react-query";
import { RecallChart } from "@/components/benchmark/recall-chart";
import { MethodLine, SystemsTable } from "@/components/benchmark/systems-table";
import { ThresholdSweepChart } from "@/components/benchmark/threshold-chart";
import { RealCasesTable, SatarkMisses } from "@/components/benchmark/real-cases";
import { ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { q } from "@/lib/api";

export default function Benchmark() {
  const report = useQuery(q.evalReport());
  const real = useQuery(q.evalReal());

  return (
    <div className="space-y-10">
      <PageHeader title="Benchmark" description="How the matcher performs on synthetic variants and on real labelled cases drawn from live data." />

      {report.error ? <ErrorState error={report.error} what="the benchmark report" /> : !report.data ? <LoadingBlock rows={3} /> : (
        <>
          <Section title="Method">
            <MethodLine report={report.data} />
          </Section>

          <Section title="Matching systems" description="Each system's own dev-picked threshold, scored on the held-out test half.">
            <SystemsTable report={report.data} />
          </Section>

          <Section className="border-t border-rule pt-8" title="F1 by threshold" description="Sweep from 50 to 99, three systems.">
            <ThresholdSweepChart report={report.data} />
          </Section>

          <Section className="border-t border-rule pt-8" title="Recall by query type" description="Satark vs RapidFuzz on each synthetic name transform.">
            <RecallChart report={report.data} />
          </Section>

          <Section className="border-t border-rule pt-8" title="Satark misses" description="Positive test queries the dev-picked threshold did not catch.">
            <SatarkMisses report={report.data} />
          </Section>
        </>
      )}

      <Section className="border-t border-rule pt-8" title="Real labelled cases" description="From live LSE LEI, Companies House and NSE data, not synthetic transforms.">
        {real.error ? <ErrorState error={real.error} what="real labelled cases" /> : !real.data ? <LoadingBlock rows={5} /> : <RealCasesTable evalReal={real.data} />}
      </Section>
    </div>
  );
}
