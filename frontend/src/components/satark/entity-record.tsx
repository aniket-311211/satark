import { FileText } from "lucide-react";
import { ListTag } from "@/components/satark/badges";
import { Facts } from "@/components/satark/page";
import { fmtDate } from "@/lib/format";
import type { Entity, Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER_TONE: Record<NonNullable<Order["status"]>, string> = {
  active: "bg-strong-soft text-strong",
  revoked: "bg-sunken text-ink-2",
  expired: "bg-sunken text-ink-2",
};

/** The listing as the regulator published it: orders with their PDFs and status, terms of office, relatives. */
export function EntityRecord({ entity, className }: { entity: Entity; className?: string }) {
  const orders = entity.details.orders ?? [];
  const terms = entity.details.terms ?? [];
  const relatives = entity.details.relatives ?? [];
  return (
    <section aria-label={`Listing: ${entity.name}`} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <ListTag source={entity.source} />
        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", entity.status === "active" ? "bg-strong-soft text-strong" : "bg-sunken text-ink-2")}>
          {entity.status === "active" ? "Active listing" : "Historical listing"}
        </span>
      </div>
      <p className="mt-2 text-base text-ink [overflow-wrap:anywhere]">{entity.name}</p>
      <Facts className="mt-3" items={[
        ["Authority", entity.authority],
        ["Aliases", entity.aliases.length ? entity.aliases.slice(0, 6).join(" · ") : null],
        ["Date of birth", entity.birth_date || null],
        ["Countries", entity.countries ? entity.countries.toUpperCase().replaceAll(";", " · ") : null],
        ["Entity id", <span className="font-mono text-xs">{entity.id}</span>],
      ]} />

      {orders.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium text-ink">Orders <span className="font-normal text-ink-2">({orders.length})</span></h4>
          <ol className="mt-2 space-y-2 border-l border-rule pl-4">
            {orders.map((o, i) => (
              <li key={i} className="relative text-[13px]">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full border border-ink bg-surface" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-ink">{fmtDate(o.date)}</span>
                  {o.status && <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", ORDER_TONE[o.status])}>{o.status}</span>}
                  {o.duration && <span className="text-ink-2">{o.duration}</span>}
                  {o.source_url && (
                    <a href={o.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-signal underline">
                      <FileText className="size-3.5" aria-hidden />Order document<span className="sr-only"> (opens the regulator's file)</span>
                    </a>
                  )}
                </div>
                {o.description && <p className="mt-0.5 text-ink-2 [overflow-wrap:anywhere]">{o.description}{o.description.length >= 200 && "…"}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {terms.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium text-ink">Terms of office</h4>
          <ul className="mt-2 space-y-1 text-[13px]">
            {terms.map((t, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 text-ink">
                {t.post} <span className="tabular text-ink-2">{t.start || "?"} – {t.end || "present"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {relatives.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium text-ink">Relatives listed</h4>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
            {relatives.map((r, i) => (
              <li key={i} className="rounded-full border border-rule px-2.5 py-0.5 text-ink">{r.name}{r.relationship && <span className="text-ink-2"> · {r.relationship}</span>}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
