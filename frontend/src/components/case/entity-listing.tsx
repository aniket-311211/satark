import { ChevronDown } from "lucide-react";
import { EntityRecord } from "@/components/satark/entity-record";
import { ListTag } from "@/components/satark/badges";
import type { Entity } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The regulator's listing behind an alert. Past three orders it collapses so one long order history doesn't push the decision below the fold. */
export function EntityListing({ entity, className }: { entity: Entity; className?: string }) {
  const orders = entity.details.orders ?? [];
  if (orders.length <= 3) return <EntityRecord entity={entity} className={className} />;

  return (
    <details className={cn("group", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-ink marker:content-none focus-visible:outline-none">
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        <ListTag source={entity.source} />
        <span className="[overflow-wrap:anywhere]">{entity.name}</span>
        <span className="text-ink-2">— {orders.length} orders on record</span>
      </summary>
      <EntityRecord entity={entity} className="mt-4" />
    </details>
  );
}
