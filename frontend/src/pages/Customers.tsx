import { useState } from "react";
import { api } from "../api";
import { ErrorNote, Name, Pill, useLoad, when } from "../components/ui";

export default function Customers({ refreshKey, onChange }: { refreshKey: number; onChange: () => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, error } = useLoad(() => api.customers(query, offset), [query, offset, refreshKey]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rescreen = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/customers/rescreen", { method: "POST" });
      const body = await response.json();
      setMessage(`Rescreened ${body.customers} customers against the full index. ${body.alerts} new alert(s).`);
      onChange();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customer book</h1>
          <p>Synthetic customers generated with Faker en_IN, with a handful of deliberately rewritten watchlist names mixed in so the review queue has real work.</p>
        </div>
        <button className="btn" disabled={busy} onClick={rescreen}>{busy ? "Rescreening…" : "Rescreen everyone"}</button>
      </div>
      {message && <div className="notice">{message}</div>}
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(q);
        }}
      >
        <input id="customer-search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search customers" />
        <button className="btn">Search</button>
      </form>
      <ErrorNote message={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Segment</th>
              <th>Born</th>
              <th>Last screened</th>
              <th style={{ textAlign: "right" }}>Open alerts</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((c) => (
              <tr key={c.id}>
                <td className="mono small faint">{c.id}</td>
                <td>
                  <Name>{c.name}</Name>
                </td>
                <td className="small">{c.kind}</td>
                <td className="small muted">{c.segment}</td>
                <td className="mono small">{c.birth_date || "—"}</td>
                <td className="small muted">{when(c.last_screened_at)}</td>
                <td className="num">{c.open_alerts ? <Pill tone="open">{c.open_alerts}</Pill> : <span className="faint">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small muted">
            {data.total === 0 ? "No customers" : `${offset + 1}–${Math.min(offset + 50, data.total)} of ${data.total.toLocaleString("en-IN")}`}
          </span>
          <div className="row">
            <button className="btn sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
            <button className="btn sm" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
