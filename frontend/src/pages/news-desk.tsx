import { PageHeader, Section } from "@/components/satark/page";
import { NewsWire } from "@/components/news/news-wire";
import { Sources } from "@/components/news/sources";
import { SubjectBrief, useQuickPicks } from "@/components/news/subject-brief";

function Brief() {
  const quickPicks = useQuickPicks();
  return <SubjectBrief quickPicks={quickPicks} />;
}

export default function NewsDesk() {
  return (
    <div className="space-y-10">
      <PageHeader title="News desk" description="Evidence from regulator and publisher feeds, checked against the source text before it's shown as fact." />

      <Section title="Subject brief" description="Run a name and see only the events whose quote and subject actually appear in the source.">
        <Brief />
      </Section>

      <Section className="border-t border-rule pt-8" title="News wire" description="Regulator orders first, press on request, grouped by the day each was fetched. Search reads the full text.">
        <NewsWire />
      </Section>

      <Section className="border-t border-rule pt-8" title="Sources" description="The feeds behind the wire and the subject brief.">
        <Sources />
      </Section>
    </div>
  );
}
