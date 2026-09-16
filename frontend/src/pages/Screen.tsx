import { useEffect, useState } from "react";
import { api, type ScreenResult } from "../api";
import { ErrorNote, MatchCard, Name } from "../components/ui";

const EXAMPLES = [
  "श्री राजीव संघवी",
  "R. Sanghvi",
  "Umashankar Srivastava",
  "Shinde Sambhaji Rao",
  "Md. Hafiz Saeed",
  "M/s Shivsathi Mercantile Pvt Ltd",
];

export default function Screen({ onChange }: { onChange: () => void }) {
  const [name, setName] = useState("श्री राजीव संघवी");
  const [kind, setKind] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onboarded, setOnboarded] = useState<string | null>(null);

  const run = async (value = name) => {
    if (value.trim().length < 2) return;
    setBusy(true);
    setOnboarded(null);
    try {
      setResult(await api.screen({ name: value, kind: kind || undefined, birth_date: birthYear || undefined, limit: 8 }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    run();
  }, []);

  const onboard = async () => {
    setBusy(true);
    try {
      const out = await api.onboard({ name, kind: kind || "person", birth_date: birthYear });
      setOnboarded(
        out.alerts.length
          ? `Onboarded ${out.customer.name} as customer #${out.customer.id}. ${out.alerts.length} alert(s) opened for review.`
          : `Onboarded ${out.customer.name} as customer #${out.customer.id}. Nothing scored above the alert threshold.`,
      );
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Screen a name</h1>
          <p>Latin or Devanagari, with honorifics, initials, relation clauses or firm suffixes. Every score shows how it was reached.</p>
        </div>
      </div>

      <form
        className="panel panel-pad stack"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <div className="search">
          <input id="screen-name" className={`input ${/[ऀ-ॿ]/.test(name) ? "deva" : ""}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shri R. K. Srivastava S/O Ram Lal" aria-label="Name to screen" />
          <select id="screen-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Entity type">
            <option value="">Auto-detect type</option>
            <option value="person">Person</option>
            <option value="org">Organisation</option>
          </select>
          <input id="screen-year" className="input" style={{ flex: "0 0 120px" }} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="Birth year" aria-label="Birth year" />
          <button className="btn primary" disabled={busy}>
            {busy ? "Screening…" : "Screen"}
          </button>
        </div>
        <div className="chips">
          <span className="label" style={{ alignSelf: "center" }}>Try</span>
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example}
              className={`chip ${/[ऀ-ॿ]/.test(example) ? "deva" : ""}`}
              onClick={() => {
                setName(example);
                run(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      <ErrorNote message={error} />

      {result && (
        <>
          <div className="pipeline" aria-label="How the query was processed">
            <div>
              <span className="step">Input</span>
              <span className="val">
                <Name>{result.query}</Name>
              </span>
            </div>
            <div>
              <span className="step">Align</span>
              <span className="val">{result.notes.length ? result.notes.join(" · ") : "no clean-up needed"}</span>
            </div>
            <div>
              <span className="step">Normalised</span>
              <span className="val">
                {result.normalized} <span className="faint">({result.kind})</span>
              </span>
            </div>
            <div>
              <span className="step">Triage</span>
              <span className="val">
                {result.candidates_scored} candidates · {result.latency_ms} ms
              </span>
            </div>
          </div>

          {onboarded && <div className="notice">{onboarded}</div>}

          <div className="panel">
            <div className="row panel-pad" style={{ borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
              <h2>
                {result.matches.length} potential match{result.matches.length === 1 ? "" : "es"}
              </h2>
              <div className="row">
                <span className="small muted">Potential matches need a reviewer. They are not findings.</span>
                <button className="btn sm" type="button" onClick={onboard} disabled={busy}>
                  Onboard as customer
                </button>
              </div>
            </div>
            {result.matches.length === 0 ? (
              <div className="empty">No list entry scored 70 or above.</div>
            ) : (
              result.matches.map((match) => <MatchCard key={match.entity_id} match={match} />)
            )}
          </div>
        </>
      )}
    </>
  );
}
