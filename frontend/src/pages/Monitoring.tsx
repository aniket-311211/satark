import { useState } from "react";
import { api, type Alert, type DeltaResult, type Stats } from "../api";
import { ErrorNote, Name, Pill, SOURCE_TONE, useLoad, when } from "../components/ui";

const STYLES = [
  { value: "devanagari", label: "Published in Devanagari" },
  { value: "initials", label: "Initials only" },
  { value: "honorific", label: "With honorific" },
  { value: "spelling", label: "Spelling variant" },
];

export default function Monitoring({ stats, onChange }: { stats: Stats | null; onChange: () => void }) {
  const lists = useLoad(() => api.watchlists());
  const [style, setStyle] = useState("devanagari");
  const [delta, setDelta] = useState<DeltaResult | null>(null);
  const [raised, setRaised] = useState<Alert | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const simulate = async () => {
    setBusy("delta");
    setRaised(undefined);
    try {
      const out = await api.simulateDelta(style);
      setDelta(out);
      let found: Alert | null = null;
      for (let attempt = 0; attempt < 12 && !found; attempt++) {
        const open = await api.alerts("open");
        found = open.items.find((a) => a.entity?.id === out.entity_id) ?? null;
        if (!found) await new Promise((r) => setTimeout(r, 700));
      }
      setRaised(found);
      setError(null);
      lists.reload();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy("refresh");
    try {
      await api.refresh();
      setError(null);
      lists.reload();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Watchlist monitoring</h1>
          <p>Lists are hashed row by row on every load. Added or changed entries are published as a delta event, and only those entries are rescreened against the customer book.</p>
        </div>
        <button className="btn" onClick={refresh} disabled={busy !== null}>
          {busy === "refresh" ? "Downloading…" : "Pull latest from OpenSanctions"}
        </button>
      </div>

      <ErrorNote message={error ?? lists.error} />

      <div className="sources">
        {(lists.data ?? []).map((list) => (
          <div key={list.key} className="panel source">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <Pill tone={SOURCE_TONE[list.category] ?? "neutral"}>{list.category}</Pill>
              <span className="mono small faint">{list.key}</span>
            </div>
            <b>{list.entities.toLocaleString("en-IN")}</b>
            <h3>{list.label}</h3>
            <span className="small muted">{list.authority}</span>
            {list.last_run && (
              <span className="small faint mono">
                {list.last_run.mode} · +{list.last_run.added} ~{list.last_run.changed} −{list.last_run.removed} · {when(list.last_run.at)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel panel-pad stack">
          <h2>Simulate a new listing</h2>
          <p className="muted small">
            Picks a customer, publishes a synthetic regulatory listing of that person in the chosen form, and sends it down the delta stream. The rescreen worker should flag the customer within seconds.
          </p>
          <div className="row">
            <select id="delta-style" className="select" value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Listing form">
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button className="btn signal" onClick={simulate} disabled={busy !== null}>
              {busy === "delta" ? "Publishing…" : "Publish listing"}
            </button>
          </div>
          {delta && (
            <dl className="kv">
              <dt>Listed as</dt>
              <dd style={{ fontSize: 18 }}>
                <Name>{delta.listed_name}</Name>
              </dd>
              <dt>Customer</dt>
              <dd>{delta.seeded_from}</dd>
              <dt>Event</dt>
              <dd className="mono small">
                {delta.bus} · {delta.event_id}
              </dd>
              <dt>Outcome</dt>
              <dd>
                {raised === undefined && "waiting for the rescreen worker…"}
                {raised === null && <span className="muted">No alert raised yet. Is `satark worker` running?</span>}
                {raised && (
                  <span>
                    <Pill tone={raised.band}>alert #{raised.id}</Pill> score {raised.score.toFixed(1)} · {raised.reasons.slice(0, 2).join("; ")}
                  </span>
                )}
              </dd>
            </dl>
          )}
        </div>

        <div className="panel panel-pad stack">
          <h2>Pipeline health</h2>
          <dl className="kv">
            <dt>Event bus</dt>
            <dd>
              <span className={`dot ${stats?.bus === "redis" ? "" : "off"}`} />
              {stats?.bus === "redis" ? "Redis Streams · consumer group rescreen" : "In-process (rescreen runs inside the API)"}
            </dd>
            <dt>Stream lag</dt>
            <dd className="mono">{stats?.stream_lag ?? 0}</dd>
            <dt>Database</dt>
            <dd className="mono">{stats?.database}</dd>
            <dt>Index</dt>
            <dd>
              {stats?.indexed_names.toLocaleString("en-IN")} names · rebuilt {when(stats?.index_built_at)}
            </dd>
            <dt>Alert threshold</dt>
            <dd className="mono">{stats?.alert_threshold}</dd>
            <dt>Metrics</dt>
            <dd>
              <a href="/api/metrics" target="_blank" rel="noreferrer">/metrics</a> <span className="faint small">Prometheus format</span>
            </dd>
          </dl>
        </div>
      </div>
    </>
  );
}
