import { api } from "../api";
import { ErrorNote, useLoad, when } from "../components/ui";

function summarize(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("  ");
}

export default function Audit({ refreshKey }: { refreshKey: number }) {
  const { data, error } = useLoad(() => api.audit(), [refreshKey]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit trail</h1>
          <p>Every ingest, onboarding, simulated listing, rescreen and analyst decision, newest first.</p>
        </div>
      </div>
      <ErrorNote message={error} />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="small muted" style={{ whiteSpace: "nowrap" }}>{when(entry.at)}</td>
                <td className="small">{entry.actor}</td>
                <td className="mono small">{entry.action}</td>
                <td className="small" style={{ overflowWrap: "anywhere" }}>{entry.target}</td>
                <td className="mono small muted" style={{ overflowWrap: "anywhere", maxWidth: 520 }}>{summarize(entry.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
