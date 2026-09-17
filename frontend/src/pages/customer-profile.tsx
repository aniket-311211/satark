import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Newspaper, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge, GroupTag } from "@/components/satark/badges";
import { EmptyState, ErrorState, Figure, LoadingBlock, PageHeader, Panel } from "@/components/satark/page";
import { KindIcon } from "@/components/customer/registry";
import { OwnershipSection, PeopleSection, RegistryFacts } from "@/components/customer/profile";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";

const KIND_LABEL = { person: "Person", org: "Organisation" } as const;

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const customer = useQuery(q.customer(Number(id)));

  if (customer.error) return <ErrorState error={customer.error} what="this customer" />;
  if (!customer.data) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex items-center gap-2.5"><KindIcon kind={c.kind} className="size-6" />{c.name}</span>}
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

      {/* Quote strip: the same three facts a reviewer would ask for first. */}
      <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3" aria-label="Customer summary">
        <div className="bg-panel p-3">
          <p className="label-caps text-ink-3">Group</p>
          <p className="mt-1"><GroupTag group={c.group} /></p>
        </div>
        <div className="bg-panel p-3">
          <Figure value={<span className="font-sans text-xl font-semibold">{KIND_LABEL[c.kind]}</span>} label="Kind" />
        </div>
        <div className="bg-panel p-3">
          <Figure value={fmtInt(openCases)} label="Open cases" tone={openCases > 0 ? "text-amber" : "text-ink"} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel label="Registry facts" meta={c.details.lei ? "GLEIF" : c.kind === "org" ? "Companies House" : undefined}>
          <RegistryFacts customer={c} />
        </Panel>
        <Panel label="Ownership">
          <OwnershipSection customer={c} />
        </Panel>
        <Panel label="Directors & PSCs" className="lg:col-span-2">
          <PeopleSection customer={c} />
        </Panel>
        <Panel label="Cases" meta={`${fmtInt(c.cases.length)} total`} className="lg:col-span-2" bodyClassName="p-0">
          {c.cases.length === 0 ? (
            <EmptyState title="No cases yet">Screening this name hasn't raised an alert that opened a case.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule">
              {c.cases.map((cs) => (
                <li key={cs.id}>
                  <Link to={`/cases/${cs.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken">
                    <span className="font-mono text-sm text-ink">Case #{cs.id}</span>
                    <CaseStatusBadge status={cs.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
