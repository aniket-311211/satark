import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/satark/page";
import { api, q } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { Dateline } from "./dateline";
import type { MediaBrief, MediaEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHECKS: { key: keyof MediaEvent["checks"]; label: string }[] = [
  { key: "quote_in_source", label: "Quote found in source" },
  { key: "subject_in_source", label: "Subject named in source" },
  { key: "extractor_says_subject", label: "Extractor says it's about the subject" },
  { key: "category_known", label: "Known risk category" },
];

function VerificationRail({ checks }: { checks: MediaEvent["checks"] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Grounding checks">
      {CHECKS.map(({ key, label }) => {
        const ok = !!checks[key];
        const Icon = ok ? Check : X;
        return (
          <li key={key} className={cn("inline-flex items-center gap-1.5 text-xs", ok ? "text-cleared" : "text-ink-2")}>
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span>{label} <span className={ok ? "text-cleared" : "text-ink-3"}>· {ok ? "Found" : "Not found"}</span></span>
          </li>
        );
      })}
    </ul>
  );
}

/** Wrap the quote in <mark> where it literally occurs in the headline, so grounded text is never restated as a paraphrase. */
function highlightQuote(headline: string, quote: string) {
  if (!quote) return null;
  const idx = headline.toLowerCase().indexOf(quote.toLowerCase());
  if (idx === -1) return null;
  return { pre: headline.slice(0, idx), match: headline.slice(idx, idx + quote.length), post: headline.slice(idx + quote.length) };
}

function Clipping({ event }: { event: MediaEvent }) {
  const inPlace = event.checks.quote_in_source ? highlightQuote(event.headline, event.quote) : null;
  return (
    <article className="border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] leading-snug text-ink [overflow-wrap:anywhere]">
          {inPlace ? <>{inPlace.pre}<mark className="bg-cleared-soft px-0.5 text-ink">{inPlace.match}</mark>{inPlace.post}</> : event.headline}
        </h3>
        {!event.verified && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap bg-sunken px-2.5 text-xs font-medium text-ink-2">
            <X className="size-3.5" aria-hidden /> Unverified
          </span>
        )}
      </div>

      {!event.checks.quote_in_source && event.quote && (
        <p className="mt-1.5 text-[13px] text-ink-2">
          Claimed quote: <span className="text-ink-3 line-through">{event.quote}</span> — not found in the source text.
        </p>
      )}
      {event.checks.subject_in_source === false && <p className="mt-1.5 text-[13px] text-ink-2">Subject not named in the source.</p>}

      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-2">
        <span>{event.publisher}</span>
        <span aria-hidden>·</span>
        <Dateline published={event.published_at} fetchedAt="" />
        <span aria-hidden>·</span>
        <span className="label-caps border border-rule-strong px-1 py-0.5">{titleCase(event.category)}</span>
        <span aria-hidden>·</span>
        <a href={event.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-signal underline underline-offset-4 hover:decoration-2">
          Source <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>

      <VerificationRail checks={event.checks} />
      <p className="mt-2 text-[11px] text-ink-3">via {event.extractor}</p>
    </article>
  );
}

function CategoryMix({ events }: { events: MediaEvent[] }) {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Category mix">
      {rows.map(([category, n]) => (
        <li key={category} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className="label-caps border border-rule-strong px-1 py-0.5">{titleCase(category)}</span>
          <span className="font-mono text-ink-3">×{n}</span>
        </li>
      ))}
    </ul>
  );
}

function GroundingEmptyState({ brief }: { brief: MediaBrief }) {
  return (
    <EmptyState title={`No verified events for "${brief.subject}"`}>
      <p>
        {brief.headlines_read === null
          ? "This subject was checked before (cached) and nothing cleared the grounding rule."
          : brief.headlines_read === 0
          ? "No feed headlines matched this subject."
          : `${brief.headlines_read} headline${brief.headlines_read === 1 ? "" : "s"} matched this subject, but none cleared the grounding rule.`}
        {" "}An event only counts once its quote appears verbatim in the source text and the subject is named there — a headline mentioning something else, or a
        namesake, is left out rather than guessed at.
      </p>
    </EmptyState>
  );
}

export function Dossier({ quickPicks }: { quickPicks: string[] }) {
  const [params, setParams] = useSearchParams();
  const [subject, setSubject] = useState(params.get("subject") ?? "");
  const ranInitial = useRef(false);
  const brief = useMutation({ mutationFn: (vars: { subject: string; refresh: boolean }) => api.mediaBrief(vars.subject, vars.refresh) });

  const run = (s: string, refresh = false) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    setParams({ subject: trimmed }, { replace: true });
    brief.mutate({ subject: trimmed, refresh });
  };

  useEffect(() => {
    if (ranInitial.current) return;
    ranInitial.current = true;
    const initial = params.get("subject");
    if (initial?.trim()) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshing = brief.isPending && brief.variables?.refresh === true;
  const running = brief.isPending && !refreshing;
  const lastSubject = brief.data?.subject;

  return (
    <div id="dossier">
      <form onSubmit={(e) => { e.preventDefault(); run(subject); }} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dossier-subject">Subject</Label>
          <Input id="dossier-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Company or person name" className="h-9 w-72 border-rule-strong bg-panel" />
        </div>
        <Button type="submit" disabled={!subject.trim() || brief.isPending}>
          {running ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Run brief
        </Button>
        {lastSubject && (
          <Button type="button" variant="outline" disabled={brief.isPending} onClick={() => run(lastSubject, true)}>
            {refreshing ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Refresh
          </Button>
        )}
      </form>

      {quickPicks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-2">Quick picks</span>
          {quickPicks.map((name) => (
            <button key={name} type="button" onClick={() => { setSubject(name); run(name); }}
              className="h-7 cursor-pointer border border-rule-strong bg-panel px-2.5 text-xs text-ink transition-colors duration-150 hover:bg-sunken">
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {brief.isError && <ErrorState error={brief.error} what="the media brief" />}
        {brief.isPending && <LoadingBlock rows={3} />}
        {!brief.isPending && brief.data && (
          brief.data.events.length === 0 ? <GroundingEmptyState brief={brief.data} /> : (
            <>
              <p className="text-[13px] text-ink-2">
                {brief.data.events.length} event{brief.data.events.length === 1 ? "" : "s"} from {brief.data.headlines_read ?? "cached"} headline{brief.data.headlines_read === 1 ? "" : "s"},
                extracted by {brief.data.extractor}{brief.data.cached && " (cached)"}
                {brief.data.trace.length > 0 && <> — {brief.data.trace.join(" → ")}</>}.
              </p>
              <CategoryMix events={brief.data.events} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {brief.data.events.map((ev) => <Clipping key={ev.id} event={ev} />)}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

/** Up to 6 distinct customer names from the open queue, so there's always something real to try the brief on. */
export function useQuickPicks(): string[] {
  const cases = useQuery(q.cases("open"));
  const names = new Set<string>();
  for (const c of cases.data?.items ?? []) {
    if (c.customer?.name) names.add(c.customer.name);
    if (names.size >= 6) break;
  }
  return [...names];
}
