import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight text-ink [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A titled region separated by space and a hairline, not a boxed card. */
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-lg leading-snug text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-rule bg-surface", className)}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 px-5 py-10">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-[60ch] text-[13px] text-ink-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, what = "this view" }: { error: unknown; what?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-strong/30 bg-strong-soft px-4 py-3 text-sm text-strong">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Couldn't load {what}.</p>
        <p className="text-[13px]">{message}. Check that the API is running (<code className="font-mono">make api</code>) and retry.</p>
      </div>
    </div>
  );
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full rounded-md bg-sunken" />)}
    </div>
  );
}

/** A quiet key/value list for record details. */
export function Facts({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-2">{k}</dt>
          <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
