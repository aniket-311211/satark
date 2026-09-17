import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { CaseAudit } from "@/components/case/case-audit";
import { CaseQuote } from "@/components/case/case-quote";
import { DecisionPanel } from "@/components/case/decision-panel";
import { EntityListing } from "@/components/case/entity-listing";
import { RegistryContext } from "@/components/case/registry-context";
import { AlertStatusBadge, ListTag } from "@/components/satark/badges";
import { IdentityEvidencePanel, NameMatchPanel } from "@/components/satark/checks";
import { ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { q } from "@/lib/api";
import { LISTS } from "@/lib/format";

export default function CaseFile() {
  const { id } = useParams();
  const caseId = Number(id);
  const { data: detail, error, isPending } = useQuery(q.case(caseId));
  const stats = useQuery(q.stats());
  const threshold = stats.data?.alert_threshold ?? 80;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Case file" />
        <ErrorState error={error} what="this case" />
      </div>
    );
  }
  if (isPending || !detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Case file" />
        <LoadingBlock rows={8} />
      </div>
    );
  }

  const customer = detail.customer;

  return (
    <div className="space-y-6">
      <PageHeader code={`CASE-${String(detail.id).padStart(3, "0")}`} title={customer?.name ?? `Case ${detail.id}`} />
      <CaseQuote detail={detail} />

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-12">
        {customer && <div className="lg:col-span-12"><RegistryContext customer={customer} parent={detail.parent} /></div>}

        <div className="lg:col-span-12">
          <Section
            title="Alerts"
            description={`${detail.alerts.length} name match${detail.alerts.length === 1 ? "" : "es"} raised this case, each checked two ways: the name itself, then independent identity evidence.`}
          >
            <div className="space-y-8">
              {detail.alerts.map((alert, i) => (
                <div key={alert.id} className={i > 0 ? "space-y-4 border-t border-rule pt-8" : "space-y-4"}>
                  {detail.alerts.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {alert.entity && <ListTag source={alert.entity.source} />}
                      <span className="text-sm text-ink-2">{LISTS[alert.entity?.source ?? ""]?.label ?? "Listing"}</span>
                      <AlertStatusBadge status={alert.status} />
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <NameMatchPanel score={alert.score} band={alert.band} matchedName={alert.matched_name} customerName={customer?.name}
                      reasons={alert.reasons} components={alert.components} threshold={threshold} />
                    <IdentityEvidencePanel secondary={alert.secondary} />
                  </div>
                  {alert.entity && <EntityListing entity={alert.entity} className="border-t border-rule pt-5" />}
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="lg:col-span-7"><DecisionPanel detail={detail} /></div>
        <div className="lg:col-span-5"><CaseAudit entries={detail.audit} /></div>
      </div>
    </div>
  );
}
