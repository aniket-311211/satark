import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { CaseAudit } from "@/components/case/case-audit";
import { DecisionPanel } from "@/components/case/decision-panel";
import { EntityListing } from "@/components/case/entity-listing";
import { RegistryContext } from "@/components/case/registry-context";
import { AlertStatusBadge, CaseStatusBadge, GroupTag, ListTag } from "@/components/satark/badges";
import { IdentityEvidencePanel, NameMatchPanel } from "@/components/satark/checks";
import { ErrorState, LoadingBlock, PageHeader, Section } from "@/components/satark/page";
import { q } from "@/lib/api";
import { fmtDate, LISTS } from "@/lib/format";

export default function CaseFile() {
  const { id } = useParams();
  const caseId = Number(id);
  const { data: detail, error, isPending } = useQuery(q.case(caseId));

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
    <div className="space-y-10">
      <PageHeader
        title={customer?.name ?? `Case ${detail.id}`}
        actions={
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
            <span className="font-mono text-ink-3">Case {detail.id}</span>
            <CaseStatusBadge status={detail.status} />
            <span>Opened {fmtDate(detail.created_at)}</span>
            {customer && <GroupTag group={customer.group} />}
            {customer && (
              <Link to={`/customers/${customer.id}`} className="inline-flex items-center gap-0.5 text-signal underline">
                Customer profile<ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        }
      />

      {customer && <RegistryContext customer={customer} parent={detail.parent} />}

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
                <NameMatchPanel score={alert.score} band={alert.band} matchedName={alert.matched_name} customerName={customer?.name} reasons={alert.reasons} />
                <IdentityEvidencePanel secondary={alert.secondary} />
              </div>
              {alert.entity && <EntityListing entity={alert.entity} className="border-t border-rule pt-5" />}
            </div>
          ))}
        </div>
      </Section>

      <DecisionPanel detail={detail} />

      <CaseAudit entries={detail.audit} />
    </div>
  );
}
