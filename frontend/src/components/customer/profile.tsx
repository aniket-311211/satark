import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, Info, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Facts } from "@/components/satark/page";
import { KindIcon, countryText, humanize, identifierText, louName } from "@/components/customer/registry";
import { fmtDate, titleCase } from "@/lib/format";
import type { Customer, CustomerDetails, CustomerProfile, ParentRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (v?: string) => {
  if (!v) return undefined;
  const [y, m] = v.split("-");
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${y}` : v;
};

function Note({ tone, icon: Icon, children }: { tone: "warn" | "quiet"; icon: LucideIcon; children: ReactNode }) {
  return (
    <p className={cn("mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]", tone === "warn" ? "bg-probable-soft text-probable" : "bg-sunken text-ink-2")}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function AppointmentsList({ appointments }: { appointments: NonNullable<CustomerDetails["appointments"]> }) {
  return (
    <div className="mt-5">
      <h4 className="text-sm font-medium text-ink">Appointments <span className="font-normal text-ink-2">({appointments.length})</span></h4>
      <ol className="mt-2 space-y-2 border-l border-rule pl-4 text-[13px]">
        {appointments.map((a, i) => (
          <li key={i} className="relative text-ink">
            <span className="absolute top-1.5 -left-[21px] size-2 rounded-sm border border-ink bg-surface" aria-hidden />
            {humanize(a.officer_role)} <span className="text-ink-2">at</span> {a.company_name}
            <span className="block text-ink-2">Appointed {fmtDate(a.appointed_on)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Registry facts as the source published them: org fields (LEI, status, Companies House) or director fields (nationality, appointments). */
export function RegistryFacts({ customer }: { customer: Customer }) {
  const d = customer.details;
  const items: [ReactNode, ReactNode][] = [];

  if (customer.kind === "org") {
    items.push(["LEI", d.lei ? (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{d.lei}</span>
        {d.gleif_url && (
          <a href={d.gleif_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-signal underline underline-offset-4">
            GLEIF record <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </span>
    ) : undefined]);
    items.push(["Legal name", d.legal_name]);
    items.push(["Other names", d.other_names?.length ? d.other_names.join(" · ") : undefined]);
    items.push(["Category", d.category ? titleCase(d.category.toLowerCase()) : undefined]);
    items.push(["Entity status", d.entity_status ? titleCase(d.entity_status.toLowerCase()) : undefined]);
    items.push(["Registration status", d.registration_status ? titleCase(d.registration_status.toLowerCase()) : undefined]);
    items.push(["Managing LOU", d.managing_lou ? louName(d.managing_lou) : undefined]);
    items.push(["Registered as", d.registered_as]);
    items.push(["City", d.city]);
    items.push(["Jurisdiction", d.jurisdiction]);
    if (d.company_number) {
      items.push(["Companies House no.", d.company_number]);
      items.push(["Company status", d.company_status ? humanize(d.company_status) : undefined]);
    }
  } else {
    items.push(["Nationality", d.nationality]);
    items.push(["Occupation", d.occupation || undefined]);
    items.push(["Born", monthYear(customer.birth_date)]);
  }

  return (
    <div>
      <Facts items={items} />
      {d.registration_status === "LAPSED" && (
        <Note tone="warn" icon={AlertTriangle}>LEI registration lapsed: the entity has stopped renewing its LEI.</Note>
      )}
      {customer.kind === "person" && (d.appointments?.length ?? 0) > 0 && <AppointmentsList appointments={d.appointments!} />}
    </div>
  );
}

const parentText = (p?: ParentRef | null): ReactNode =>
  p && (
    <span className="flex flex-wrap items-center gap-2">
      {p.name}
      {p.country && <span className="text-ink-2">({p.country.toUpperCase()})</span>}
      <span className="font-mono text-xs text-ink-2">{p.lei}</span>
    </span>
  );

function ChildrenTable({ children }: { children: Customer[] }) {
  const label = children[0]?.kind === "person" ? "Directors" : "Subsidiaries";
  return (
    <div className="mt-5">
      <h4 className="text-sm font-medium text-ink">{label} <span className="font-normal text-ink-2">({children.length})</span></h4>
      <div className="mt-2 overflow-x-auto rounded-xl border border-rule bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-rule text-xs text-ink-2">
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Detail</th>
              <th scope="col" className="px-3 py-2 font-medium">Open alerts</th>
            </tr>
          </thead>
          <tbody>
            {children.map((c) => (
              <tr key={c.id} className="border-b border-rule/70 last:border-0">
                <td className="px-3 py-2">
                  <Link to={`/customers/${c.id}`} className="flex items-center gap-2 text-ink hover:text-signal">
                    <KindIcon kind={c.kind} /> <span className="[overflow-wrap:anywhere]">{c.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-2">{c.kind === "person" ? identifierText(c) : countryText(c)}</td>
                <td className="px-3 py-2 font-mono text-ink">{c.open_alerts ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PscSection({ details }: { details: CustomerDetails }) {
  const psc = details.psc ?? [];
  const statements = details.psc_statements ?? [];
  if (!psc.length && !statements.length) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-medium text-ink">People with significant control</h4>
      {psc.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-[13px]">
          {psc.map((p, i) => (
            <li key={i} className="text-ink">
              {p.name || humanize(p.kind)}
              {p.natures_of_control.length > 0 && <span className="block text-ink-2">{p.natures_of_control.map(humanize).join(" · ")}</span>}
            </li>
          ))}
        </ul>
      )}
      {statements.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
          {statements.map((s, i) => <li key={i}>{humanize(s)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Parents (registry text plus a link when the parent is itself a customer), children, and PSC — with mismatches flagged as review notes, not findings. */
export function OwnershipSection({ customer }: { customer: CustomerProfile }) {
  const d = customer.details;
  const hasParents = Boolean(d.direct_parent || d.ultimate_parent);
  return (
    <div>
      {hasParents && (
        <Facts items={[
          ["Direct parent", parentText(d.direct_parent)],
          ["Ultimate parent", parentText(d.ultimate_parent)],
        ]} />
      )}
      {customer.parent && (
        <p className={cn("text-sm", hasParents && "mt-3")}>
          <span className="text-ink-2">In this book: </span>
          <Link to={`/customers/${customer.parent.id}`} className="text-signal underline underline-offset-4">{customer.parent.name}</Link>
        </p>
      )}
      {d.ownership_conflict?.conflict && (
        <Note tone="quiet" icon={Info}>
          {d.ownership_conflict.reason ? `${d.ownership_conflict.reason}. ` : ""}This is a registry mismatch to review, not a finding.
        </Note>
      )}
      {customer.children.length > 0 && <ChildrenTable children={customer.children} />}
      <PscSection details={d} />
      {!hasParents && !customer.parent && !customer.children.length && !d.psc?.length && !d.psc_statements?.length && (
        <p className="text-sm text-ink-2">No ownership data on file for this customer.</p>
      )}
    </div>
  );
}
