import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/satark/page";
import { MatchResult } from "@/components/screen/match-result";
import { ScreenForm, type ScreenFormValues } from "@/components/screen/screen-form";
import { api, q } from "@/lib/api";
import { fmtInt } from "@/lib/format";

const KIND_VALUES = new Set(["person", "org"]);

function valuesFromParams(params: URLSearchParams): ScreenFormValues {
  const kind = params.get("kind") ?? "";
  return {
    name: params.get("name") ?? "",
    kind: KIND_VALUES.has(kind) ? (kind as "person" | "org") : "",
    birth_date: params.get("birth_date") ?? "",
    nationality: params.get("nationality") ?? "",
    country: (params.get("country") ?? "").toUpperCase().slice(0, 2),
  };
}

export default function Screen() {
  const [params, setParams] = useSearchParams();
  const [values, setValues] = useState<ScreenFormValues>(() => valuesFromParams(params));
  const stats = useQuery(q.stats());
  const threshold = stats.data?.alert_threshold ?? 80;
  const mutation = useMutation({
    mutationFn: (v: ScreenFormValues) =>
      api.screen({
        name: v.name.trim(),
        kind: v.kind || null,
        birth_date: v.birth_date.trim() || undefined,
        nationality: v.nationality.trim() || undefined,
        country: v.country.trim() || undefined,
        limit: 10,
      }),
  });
  const result = mutation.data;

  // Auto-run once when the page loads with a name already in the URL (e.g. from a customer profile's "Screen this name").
  const ranOnce = useRef(false);
  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    if (values.name.trim()) mutation.mutate(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (v: ScreenFormValues) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      (Object.entries(v) as [string, string][]).forEach(([k, val]) => (val ? next.set(k, val) : next.delete(k)));
      return next;
    }, { replace: true });
    mutation.mutate(v);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Screen a name"
        description="Both checks, side by side: how the name compares against five watchlists, and whether independent identity evidence supports or contradicts that match."
      />

      <ScreenForm values={values} onChange={setValues} onSubmit={handleSubmit} submitting={mutation.isPending} />

      {mutation.isIdle && (
        <EmptyState title="Nothing screened yet">
          Enter a name above and choose Screen. Satark checks it against five watchlists, then compares date of birth, nationality and PEP term age wherever you provide them.
        </EmptyState>
      )}
      {mutation.isPending && <LoadingBlock rows={6} />}
      {mutation.isError && <ErrorState error={mutation.error} what="the screening" />}

      {result && (
        <div className="space-y-8">
          <div className="border-b border-rule pb-5">
            {result.notes.length > 0 && (
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ArrowRight className="size-3 text-ink-3" aria-hidden />}
                    {n}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-sm text-ink">Normalised to <span className="font-mono">{result.normalized}</span></p>
            <p className="mt-1 text-sm text-ink-2">{fmtInt(result.candidates_scored)} candidates scored in {result.latency_ms.toFixed(1)} ms.</p>
            <p className="mt-1 text-sm text-ink-2">Screening shows matches from 70; alerts start at {threshold}.</p>
          </div>

          {result.matches.length === 0 ? (
            <EmptyState title="No matches">No listing scored above 70 for this name.</EmptyState>
          ) : (
            <ul>
              {result.matches.map((m) => <MatchResult key={m.entity_id} match={m} queryName={result.query} threshold={threshold} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
