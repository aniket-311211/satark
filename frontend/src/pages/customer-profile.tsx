import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Newspaper, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge, GroupTag } from "@/components/satark/badges";
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { KindIcon } from "@/components/customer/registry";
import { OwnershipSection, RegistryFacts } from "@/components/customer/profile";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const customer = useQuery(q.customer(Number(id)));

  if (customer.error) return <ErrorState error={customer.error} what="this customer" />;
  if (!customer.data) {
    return (
      <div className="space-y-10">
        <PageHeader title="Customer" />
        <LoadingBlock rows={8} />
      </div>
    );
  }

  const c = customer.data;
  const openCases = c.cases.filter((cs) => cs.status !== "closed").length;
  const screenParams = new URLSearchParams({ name: c.name, kind: c.kind });
  if (c.birth_date) screenParams.set("birth_date", c.birth_date);
  if (c.details.nationality) screenParams.set("nationality", c.details.nationality);

  return (
    <div className="space-y-10">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><KindIcon kind={c.kind} className="size-6" />{c.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <GroupTag group={c.group} />
            <span>{fmtInt(openCases)} open case{openCases === 1 ? "" : "s"}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/screen?${screenParams.toString()}`}><ScanSearch aria-hidden /> Screen this name</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/news?subject=${encodeURIComponent(c.name)}`}><Newspaper aria-hidden /> Check the news</Link>
            </Button>
          </>
        }
      />

      <Section title="Registry facts">
        <RegistryFacts customer={c} />
      </Section>

      <Section title="Ownership" className="border-t border-rule pt-8">
        <OwnershipSection customer={c} />
      </Section>

      <Section title="Cases" className="border-t border-rule pt-8">
        {c.cases.length === 0 ? (
          <EmptyState title="No cases yet">Screening this name hasn't raised an alert that opened a case.</EmptyState>
        ) : (
          <ul className="divide-y divide-rule rounded-xl border border-rule bg-surface">
            {c.cases.map((cs) => (
              <li key={cs.id}>
                <Link to={`/cases/${cs.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-sunken/70 focus-visible:bg-sunken">
                  <span className="text-sm text-ink">Case #{cs.id}</span>
                  <CaseStatusBadge status={cs.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
