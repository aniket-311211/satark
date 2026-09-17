import { Link } from "react-router";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { GroupTag } from "@/components/satark/badges";
import { Facts } from "@/components/satark/page";
import { fmtDate, titleCase } from "@/lib/format";
import type { Customer } from "@/lib/types";

/** What the registries say about the customer: enough to judge the alerts without leaving the case. */
export function RegistryContext({ customer, parent }: { customer: Customer; parent: Customer | null }) {
  const d = customer.details;
  const lapsed = d.registration_status === "LAPSED";
  const conflict = d.ownership_conflict?.conflict;
  const parentRef = d.direct_parent ?? d.ultimate_parent;
  const facts: [string, React.ReactNode][] = customer.kind === "org"
    ? [
        ["LEI", d.lei ? <a href={d.gleif_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-signal underline">{d.lei}<ArrowUpRight className="size-3" aria-hidden /><span className="sr-only"> (GLEIF record)</span></a> : null],
        [d.company_number ? "Company no." : "Registered as", <span className="font-mono text-xs">{d.company_number ?? d.registered_as ?? "—"}</span>],
        ["Entity status", d.entity_status ? titleCase(d.entity_status.toLowerCase()) : d.company_status ? titleCase(d.company_status) : null],
        ["LEI registration", d.registration_status ? (
          <span className={lapsed ? "font-medium text-strong" : undefined}>{titleCase(d.registration_status.toLowerCase())}{lapsed && " · not renewed"}</span>
        ) : null],
        ["City", d.city ? titleCase(d.city.toLowerCase()) : null],
        ["Parent", parent ? <Link to={`/customers/${parent.id}`} className="text-signal underline">{parent.name}</Link> : parentRef ? `${parentRef.name} (${parentRef.country.toUpperCase()})` : null],
      ]
    : [
        ["Born", customer.birth_date || null],
        ["Nationality", d.nationality || null],
        ["Appointments", d.appointments?.length ? (
          <ul className="space-y-0.5">
            {d.appointments.map((a) => <li key={a.company_number}>{titleCase(a.officer_role)}, {a.company_name} <span className="text-ink-2">since {fmtDate(a.appointed_on)}</span></li>)}
          </ul>
        ) : null],
        ["Company", parent ? <Link to={`/customers/${parent.id}`} className="text-signal underline">{parent.name}</Link> : null],
      ];

  return (
    <section aria-labelledby="registry-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="registry-heading" className="text-lg text-ink">Registry record</h2>
        <GroupTag group={customer.group} />
      </div>
      {(lapsed || conflict) && (
        <ul className="space-y-1.5">
          {lapsed && (
            <li className="flex items-start gap-2 rounded-lg bg-strong-soft px-3 py-2 text-[13px] text-strong">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />LEI lapsed: the entity stopped renewing its registration with GLEIF.
            </li>
          )}
          {conflict && (
            <li className="flex items-start gap-2 rounded-lg bg-probable-soft px-3 py-2 text-[13px] text-probable">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />Registry mismatch: {d.ownership_conflict?.reason}.
            </li>
          )}
        </ul>
      )}
      <Facts items={facts} />
      <Link to={`/customers/${customer.id}`} className="inline-flex items-center gap-1 text-[13px] text-signal underline">
        Full customer profile<ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
