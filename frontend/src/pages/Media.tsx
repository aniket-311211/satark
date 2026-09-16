import { useState } from "react";
import { api, type MediaBrief } from "../api";
import { ErrorNote, Pill } from "../components/ui";

const CHECK_LABEL: Record<string, string> = {
  quote_in_source: "quote found in source",
  subject_in_source: "subject named in source",
  extractor_says_subject: "extractor judged same person",
  category_known: "known risk category",
};

export default function Media({ llm }: { llm: boolean }) {
  const [subject, setSubject] = useState("Mehul Choksi");
  const [brief, setBrief] = useState<MediaBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (refresh: boolean) => {
    setBusy(true);
    try {
      setBrief(await api.media(subject, refresh));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verified = brief?.events.filter((e) => e.verified).length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Adverse media</h1>
          <p>
            A three-step agent reads Indian news headlines, extracts risk events, then checks each one against its source before an analyst sees it.
            {llm ? " Extraction uses Claude." : " No API key set, so extraction uses keyword rules. Set ANTHROPIC_API_KEY to switch to Claude."}
          </p>
        </div>
      </div>

      <form
        className="panel panel-pad search"
        onSubmit={(e) => {
          e.preventDefault();
          run(false);
        }}
      >
        <input id="media-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Person or company" />
        <button className="btn primary" disabled={busy}>{busy ? "Reading…" : "Build brief"}</button>
        <button className="btn" type="button" disabled={busy} onClick={() => run(true)}>Refresh from news</button>
      </form>

      <ErrorNote message={error} />

      {brief && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="trace">
              {(brief.trace.length ? brief.trace : ["cached brief"]).map((step) => (
                <span key={step}>{step}</span>
              ))}
            </div>
            <span className="small muted">
              {verified} of {brief.events.length} events grounded · extractor <span className="mono">{brief.extractor}</span>
            </span>
          </div>
          {brief.errors.map((message) => (
            <div key={message} className="notice">{message}</div>
          ))}
          <div className="panel">
            {brief.events.length === 0 && <div className="empty">No adverse headlines found for this subject.</div>}
            {brief.events.map((event) => (
              <div key={event.id} className="event" style={{ opacity: event.verified ? 1 : 0.72 }}>
                <div className="row">
                  <Pill tone={event.verified ? "ok" : "neutral"}>{event.verified ? "grounded" : "needs review"}</Pill>
                  <Pill tone="probable">{event.category.replace(/_/g, " ")}</Pill>
                  <span className="small muted">
                    {event.publisher} · {event.published_at.slice(0, 16)}
                  </span>
                </div>
                <h3>
                  <a href={event.url} target="_blank" rel="noreferrer">{event.headline}</a>
                </h3>
                {event.summary && event.summary !== event.headline && <p className="small">{event.summary}</p>}
                <blockquote>“{event.quote}”</blockquote>
                <div className="checks">
                  {Object.entries(event.checks).map(([key, ok]) => (
                    <span key={key} className={`check ${ok ? "pass" : "fail"}`}>{CHECK_LABEL[key] ?? key}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
