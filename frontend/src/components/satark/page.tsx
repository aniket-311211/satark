import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Screen header: title, one line of purpose, actions on the right.
 * `brand` sets the product name in the wordmark's face before the title (Satark Overview, Satark Queue);
 * `code` is for record identifiers (CASE-033), never a screen label.
 */
export function PageHeader({ title, description, actions, code, brand }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; code?: string; brand?: boolean }) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-rule pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-baseline gap-x-3 text-[26px] leading-tight text-ink [overflow-wrap:anywhere]">
          {code && <span className="font-mono text-[13px] font-normal tracking-normal text-amber [font-stretch:88%]">{code}</span>}
          {brand && <span className="font-extrabold tracking-[0.1em] uppercase [font-stretch:125%]">Satark</span>}
          <span className="min-w-0">{title}</span>
        </h1>
        {description && <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A titled region on the page ground, separated by a hairline rather than boxed. */
export function Section({ title, description, actions, children, className }: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] leading-snug text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A terminal panel: graphite glass with a hairline edge and a function label strip.
 * Panels sit side by side on the wall; never nest one inside another.
 */
export function Panel({ label, meta, actions, children, className, bodyClassName }: {
  label?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col border border-rule bg-panel", className)}>
      {(label || actions || meta) && (
        <div className="flex min-h-9 items-center gap-3 border-b border-rule px-3">
          {label && <h2 className="label-caps min-w-0 truncate text-ink-2">{label}</h2>}
          {meta && <span className="min-w-0 truncate text-[12px] text-ink-3">{meta}</span>}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("min-w-0 flex-1 p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A figure as a terminal quote: the number in mono, its label in condensed caps, an optional sub-line. */
export function Figure({ value, label, sub, tone = "text-ink", className }: { value: ReactNode; label: ReactNode; sub?: ReactNode; tone?: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="label-caps text-ink-3">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl leading-none", tone)}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-ink-2">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 px-4 py-8">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-[60ch] text-[13px] text-ink-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, what = "this view" }: { error: unknown; what?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex items-start gap-3 border border-strong/50 bg-strong-soft px-4 py-3 text-sm text-strong">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Couldn't load {what}.</p>
        <p className="text-[13px] text-ink">{message}. Check that the API is running (<code>make api</code>) and retry.</p>
      </div>
    </div>
  );
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full rounded-none bg-sunken" />)}
    </div>
  );
}

/** Key/value record details, labels in the quiet column. */
export function Facts({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
