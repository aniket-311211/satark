import { AlertTriangle, Building2, User } from "lucide-react";
import type { Customer, CustomerDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

export const LSE_LOU = "213800WAVVOPS85N2205";
export const louName = (code?: string) => (code === LSE_LOU ? "London Stock Exchange LEI Ltd" : code || "—");

/** "ownership-of-shares-75-to-100-percent" → "Ownership of shares 75 to 100 percent". Companies House spells one statement "signficant". */
export const humanize = (slug: string) => {
  const text = slug.replace(/signficant/g, "significant").replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function KindIcon({ kind, className }: { kind: Customer["kind"]; className?: string }) {
  const Icon = kind === "org" ? Building2 : User;
  return <Icon className={cn("size-4 shrink-0 text-ink-3", className)} aria-label={kind === "org" ? "Company" : "Person"} />;
}

/** The identifier an analyst would quote: the LEI for entities, the appointment for directors. */
export function identifierText(c: Customer) {
  if (c.details.lei) return c.details.lei;
  const first = c.details.appointments?.[0];
  if (!first) return "";
  const more = (c.details.appointments?.length ?? 1) - 1;
  return `${humanize(first.officer_role)} · ${first.company_name}${more > 0 ? ` +${more}` : ""}`;
}

export const countryText = (c: Customer) =>
  c.kind === "person" ? c.details.nationality || "" : (c.details.jurisdiction || c.country || "").toUpperCase();

type Flag = { label: string; tone: "warn" | "quiet" | "ok" };

/** Registry states worth a second look: a lapsed LEI, an inactive entity, a UK company in liquidation or dissolved. */
export function registryFlags(d: CustomerDetails): Flag[] {
  const flags: Flag[] = [];
  const reg = d.registration_status;
  if (reg === "LAPSED") flags.push({ label: "LEI lapsed", tone: "warn" });
  else if (reg && reg !== "ISSUED") flags.push({ label: `LEI ${reg.toLowerCase().replace(/_/g, " ")}`, tone: "quiet" });
  if (d.entity_status === "INACTIVE") flags.push({ label: "Entity inactive", tone: "quiet" });
  const ch = d.company_status;
  if (ch === "liquidation") flags.push({ label: "In liquidation", tone: "warn" });
  else if (ch === "dissolved") flags.push({ label: "Dissolved", tone: "warn" });
  else if (ch && ch !== "active") flags.push({ label: humanize(ch), tone: "quiet" });
  if (!flags.length && reg === "ISSUED") flags.push({ label: "LEI issued", tone: "ok" });
  return flags;
}

export function RegistryStatus({ details }: { details: CustomerDetails }) {
  const flags = registryFlags(details);
  if (!flags.length) return <span className="text-ink-3">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {flags.map((f) => (
        <span key={f.label} className={cn(
          "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-sm px-2.5 text-xs",
          f.tone === "warn" ? "bg-amber-soft font-medium text-amber" : f.tone === "quiet" ? "bg-sunken text-ink-2" : "text-ink-2",
        )}>
          {f.tone === "warn" && <AlertTriangle className="size-3.5" aria-hidden />}
          {f.label}
        </span>
      ))}
    </span>
  );
}
