import { useEffect, useMemo, useState } from "react";
import { api, type Alert } from "../api";
import { ErrorNote, Name, Pill, ScoreBlock, SOURCE_SHORT, SOURCE_TONE, useLoad, when } from "../components/ui";

const STATUSES = ["open", "escalated", "confirmed", "discarded"] as const;
const TRIGGER_LABEL: Record<string, string> = {
  onboarding: "onboarding",
  watchlist_delta: "new listing",
  batch: "batch rescreen",
};

export default function Alerts({ onChange, refreshKey }: { onChange: () => void; refreshKey: number }) {
  const [status, setStatus] = useState<string>("open");
  const { data, error, reload, loading } = useLoad(() => api.alerts(status), [status, refreshKey]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const selected = useMemo<Alert | null>(() => items.find((a) => a.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => setNote(""), [selected?.id]);

  const decide = async (decision: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.decide(selected.id, decision, note);
      setActionError(null);
      setSelectedId(null);
      await reload();
      onChange();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review queue</h1>
          <p>Alerts open when a customer scores at or above the alert threshold, at onboarding or when a new listing arrives. Every decision is written to the audit log.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {STATUSES.map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setSelectedId(null); }}>
            {s}
            {status === s && data && <span className="mono">{data.total}</span>}
          </button>
        ))}
      </div>

      <ErrorNote message={error} />

      <div className="grid-2">
        <div className="panel table-wrap" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th className="sev" />
                <th>Customer</th>
                <th>Listed as</th>
                <th>List</th>
                <th>Trigger</th>
                <th style={{ textAlign: "right" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {items.map((alert) => (
                <tr key={alert.id} className={`clickable ${selected?.id === alert.id ? "selected" : ""}`} onClick={() => setSelectedId(alert.id)}>
                  <td className={`sev ${alert.band}`} />
                  <td>
                    <Name>{alert.customer?.name ?? "—"}</Name>
                  </td>
                  <td>
                    <Name>{alert.entity?.name ?? alert.matched_name}</Name>
                  </td>
                  <td className="small">{alert.entity ? SOURCE_SHORT[alert.entity.source] ?? alert.entity.source : "—"}</td>
                  <td className="small muted">{TRIGGER_LABEL[alert.trigger] ?? alert.trigger}</td>
                  <td className="num">{alert.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 && <div className="empty">No {status} alerts.</div>}
        </div>

        {selected && (
          <div className="panel panel-pad stack">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
              <div className="stack" style={{ gap: 4 }}>
                <span className="label">Alert #{selected.id} · {when(selected.created_at)}</span>
                <h2>
                  <Name>{selected.customer?.name ?? ""}</Name>
                </h2>
                <span className="muted small">
                  may be <Name>{selected.entity?.name ?? selected.matched_name}</Name>
                </span>
                <div className="row">
                  <Pill tone={selected.band}>{selected.band}</Pill>
                  <Pill tone={selected.status}>{selected.status}</Pill>
                  <Pill tone="neutral">{TRIGGER_LABEL[selected.trigger] ?? selected.trigger}</Pill>
                </div>
              </div>
              <ScoreBlock score={selected.score} band={selected.band} />
            </div>

            <div>
              <span className="label">Why it matched</span>
              <ul className="reasons" style={{ marginTop: 4 }}>
                {selected.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            {selected.entity && (
              <dl className="kv">
                <dt>List</dt>
                <dd>
                  <Pill tone={SOURCE_TONE[selected.entity.category] ?? "neutral"}>{selected.entity.category}</Pill> {selected.entity.source_label}
                </dd>
                <dt>Authority</dt>
                <dd>{selected.entity.authority}</dd>
                {selected.entity.aliases.length > 0 && (
                  <>
                    <dt>Aliases</dt>
                    <dd>{selected.entity.aliases.slice(0, 6).join(" · ")}</dd>
                  </>
                )}
                {selected.entity.sanctions && selected.entity.sanctions.replace(/[;"]/g, "") && (
                  <>
                    <dt>Programme</dt>
                    <dd>{selected.entity.sanctions.replace(/^;/, "")}</dd>
                  </>
                )}
                {selected.entity.birth_date && (
                  <>
                    <dt>Born</dt>
                    <dd>{selected.entity.birth_date}</dd>
                  </>
                )}
                <dt>Entity id</dt>
                <dd className="mono small">{selected.entity.id}</dd>
                <dt>Customer</dt>
                <dd>
                  #{selected.customer?.id} · {selected.customer?.segment} {selected.customer?.birth_date && `· born ${selected.customer.birth_date}`}
                  {selected.customer?.synthetic && <span className="faint"> · synthetic</span>}
                </dd>
              </dl>
            )}

            {selected.status === "open" ? (
              <div className="stack">
                <textarea id="decision-note" className="textarea" rows={2} placeholder="Reason for the decision (e.g. DOB on file differs, different father's name)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="row">
                  <button className="btn" disabled={busy} onClick={() => decide("discarded")}>Discard as false positive</button>
                  <button className="btn signal" disabled={busy} onClick={() => decide("escalated")}>Escalate</button>
                  <button className="btn primary" disabled={busy} onClick={() => decide("confirmed")}>Confirm match</button>
                </div>
                <ErrorNote message={actionError} />
              </div>
            ) : (
              <p className="small muted">
                {selected.status} by {selected.decided_by} · {when(selected.decided_at)}
                {selected.note && ` — “${selected.note}”`}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
