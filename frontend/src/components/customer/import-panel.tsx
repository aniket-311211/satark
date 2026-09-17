import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowUpRight, Download, FileUp, ShieldCheck, TriangleAlert, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupTag } from "@/components/satark/badges";
import { ErrorState, Panel } from "@/components/satark/page";
import { IMPORT_TEMPLATE_URL, api } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import type { ImportReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: [string, string][] = [
  ["name", "required · the customer's full or legal name"],
  ["kind", "person or org (defaults to person)"],
  ["date_of_birth", "YYYY, YYYY-MM, YYYY-MM-DD or DD/MM/YYYY"],
  ["nationality", "e.g. Indian (supporting evidence only)"],
  ["country", "two-letter code, e.g. IN or GB"],
  ["customer_id", "your reference; re-uploads update instead of duplicating"],
];

function Reading({ label, children, tone = "text-ink-2" }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className={cn("flex items-baseline gap-2 px-3 py-2", tone)}>
      <span className="label-caps text-ink-3">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Rejected({ errors }: { errors: ImportReport["errors"] }) {
  if (errors.length === 0) return null;
  return (
    <div className="border border-strong/40">
      <p className="flex items-center gap-2 border-b border-strong/40 bg-strong-soft px-3 py-2 text-[13px] text-strong">
        <TriangleAlert className="size-4" aria-hidden /> {fmtInt(errors.length)} {errors.length === 1 ? "row" : "rows"} won't import. Fix them in the file and upload it again.
      </p>
      <ul className="max-h-48 divide-y divide-rule overflow-y-auto">
        {errors.map((e) => (
          <li key={`${e.line}-${e.reason}`} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-3 py-1.5 text-[12.5px] sm:grid-cols-[4rem_minmax(0,14rem)_minmax(0,1fr)]">
            <span className="font-mono text-ink-3">line {e.line}</span>
            <span className="truncate text-ink max-sm:hidden">{e.name || "—"}</span>
            <span className="text-ink-2">{e.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Import the analyst's own customer file. Step 1 validates it (a dry run: nothing is written);
 * step 2 imports the valid rows as group D and screens only those customers.
 */
export function ImportPanel({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const check = useMutation({ mutationFn: (text: string) => api.importCustomers(text, true) });
  const run = useMutation({
    mutationFn: (text: string) => api.importCustomers(text, false),
    onSuccess: () => Promise.all(["customers", "cases", "alerts", "stats", "audit"].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  });

  const load = async (picked: File | undefined) => {
    if (!picked) return;
    const text = await picked.text();
    setFile({ name: picked.name, text });
    run.reset();
    check.mutate(text);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void load(e.dataTransfer.files[0]); };
  const reset = () => { setFile(null); check.reset(); run.reset(); if (input.current) input.current.value = ""; };

  const preview = check.data;
  const result = run.data;

  return (
    <Panel label="Import customers" meta="Your own file, screened on upload" actions={
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close import"><X /></Button>
    }>
      {result ? (
        <div className="space-y-3">
          <div className="flex flex-col divide-y divide-rule border border-rule text-[13px] sm:flex-row sm:flex-wrap sm:divide-x sm:divide-y-0" role="status">
            <Reading label="Imported"><span className="font-mono text-ink">{fmtInt(result.added ?? 0)}</span> new · <span className="font-mono text-ink">{fmtInt(result.updated ?? 0)}</span> updated</Reading>
            <Reading label="Screened"><span className="font-mono text-ink">{fmtInt(result.screened ?? 0)}</span> customers</Reading>
            <Reading label="Alerts" tone="text-amber"><span className="font-mono">{fmtInt(result.alerts ?? 0)}</span> opened for review</Reading>
            <Reading label="Auto-cleared" tone="text-cleared"><span className="font-mono">{fmtInt(result.auto_cleared ?? 0)}</span> by identity evidence</Reading>
          </div>
          {result.hits && result.hits.length > 0 ? (
            <ul className="divide-y divide-rule border border-rule">
              {result.hits.map((h) => (
                <li key={h.customer.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[13px]">
                  <Link to={`/customers/${h.customer.id}`} className="min-w-0 flex-1 truncate text-ink hover:text-signal">{h.customer.name}</Link>
                  {h.alerts > 0 && <span className="text-amber"><span className="font-mono">{h.alerts}</span> open</span>}
                  {h.auto_cleared > 0 && <span className="inline-flex items-center gap-1 text-cleared"><ShieldCheck className="size-3.5" aria-hidden /><span className="font-mono">{h.auto_cleared}</span> cleared</span>}
                  {h.case_id && (
                    <Link to={`/cases/${h.case_id}`} className="inline-flex items-center gap-1 text-signal underline underline-offset-4">Case {h.case_id} <ArrowUpRight className="size-3" aria-hidden /></Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-2">No uploaded customer matched an active listing at the alert threshold.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}><FileUp aria-hidden /> Import another file</Button>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-3">
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
              className={cn("flex flex-col items-start gap-3 border border-dashed p-4 transition-colors duration-150", dragging ? "border-amber bg-amber-soft" : "border-rule-strong")}>
              <p className="text-[13px] text-ink-2">Drop a CSV here, or choose one. Nothing is saved until you import.</p>
              <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="import-file" onChange={(e) => void load(e.target.files?.[0])} />
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><label htmlFor="import-file" className="cursor-pointer"><FileUp aria-hidden /> Choose a CSV file</label></Button>
                <Button asChild variant="ghost"><a href={IMPORT_TEMPLATE_URL} download><Download aria-hidden /> Template</a></Button>
              </div>
              {file && <p className="text-[12.5px] text-ink-3">Checking <span className="font-mono text-ink-2">{file.name}</span></p>}
            </div>
            <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
              {COLUMNS.map(([column, help]) => (
                <div key={column} className="contents">
                  <dt className="font-mono text-ink-2">{column}</dt>
                  <dd className="text-ink-3">{help}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center gap-2 text-[12.5px] text-ink-3">Uploaded customers join the book as <GroupTag group="D" /></p>
          </div>

          <div className="min-w-0 space-y-3">
            {check.error ? <ErrorState error={check.error} what="the file check" /> : !preview ? (
              <p className="border border-rule px-3 py-6 text-[13px] text-ink-3">The rows that will import, and any that won't, show here once you pick a file.</p>
            ) : (
              <>
                <div className="flex flex-col divide-y divide-rule border border-rule text-[13px] sm:flex-row sm:divide-x sm:divide-y-0">
                  <Reading label="Ready"><span className="font-mono text-ink">{fmtInt(preview.valid)}</span> {preview.valid === 1 ? "row" : "rows"}</Reading>
                  <Reading label="Rejected" tone={preview.rejected ? "text-strong" : "text-ink-2"}><span className="font-mono">{fmtInt(preview.rejected)}</span></Reading>
                </div>
                <Rejected errors={preview.errors} />
                {preview.preview.length > 0 && (
                  <div className="overflow-x-auto border border-rule">
                    <table className="w-full text-[12.5px]">
                      <caption className="sr-only">First rows that will import</caption>
                      <thead>
                        <tr className="border-b border-rule text-left">
                          {["Line", "Name", "Kind", "Date of birth", "Nationality", "Country"].map((h) => <th key={h} scope="col" className="label-caps px-3 py-2 font-semibold text-ink-3">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule">
                        {preview.preview.map((row) => (
                          <tr key={row.line}>
                            <td className="px-3 py-1.5 font-mono text-ink-3">{row.line}</td>
                            <td className="max-w-[16rem] truncate px-3 py-1.5 text-ink">{row.name}</td>
                            <td className="px-3 py-1.5 text-ink-2">{row.kind === "org" ? "Organisation" : "Person"}</td>
                            <td className="px-3 py-1.5 font-mono text-ink-2">{row.birth_date || "—"}</td>
                            <td className="px-3 py-1.5 text-ink-2">{row.nationality || "—"}</td>
                            <td className="px-3 py-1.5 text-ink-2 uppercase">{row.country || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.valid > preview.preview.length && <p className="border-t border-rule px-3 py-1.5 text-[12px] text-ink-3">and {fmtInt(preview.valid - preview.preview.length)} more</p>}
                  </div>
                )}
                {run.error && <ErrorState error={run.error} what="the import" />}
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => file && run.mutate(file.text)} disabled={!preview.valid || run.isPending}>
                    <Upload aria-hidden /> {run.isPending ? "Importing and screening…" : `Import and screen ${fmtInt(preview.valid)} ${preview.valid === 1 ? "customer" : "customers"}`}
                  </Button>
                  <Button variant="ghost" onClick={reset} disabled={run.isPending}>Choose another file</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
