import { useState } from "react";
import { api, type EvalReport } from "../api";
import { ErrorNote, useLoad } from "../components/ui";

const SYSTEMS = [
  { key: "satark", label: "Satark", note: "Indic normaliser + phonetic keys + weighted alignment" },
  { key: "rapidfuzz", label: "RapidFuzz", note: "token_sort_ratio over every list name" },
  { key: "exact", label: "Exact", note: "case- and punctuation-insensitive lookup" },
];
const TRANSFORM_LABEL: Record<string, string> = {
  honorific: "Honorific",
  initials: "Initials",
  reorder: "Name order",
  drop_middle: "Middle name dropped",
  spelling: "Spelling variant",
  typo: "Typo",
  devanagari: "Devanagari",
  relation: "S/O · D/O clause",
  abbreviation: "Md. · Kr. · Pd.",
  combo: "Two changes",
  random_person: "Not listed (random)",
  surname_swap: "Not listed (same first name)",
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function SweepChart({ report }: { report: EvalReport }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const height = 240;
  const pad = { l: 40, r: 88, t: 14, b: 30 };
  const lines = ["satark", "rapidfuzz"];
  const xs = report.sweeps.satark.map((p) => p.threshold);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (t: number) => pad.l + ((t - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v) * (height - pad.t - pad.b);
  const path = (key: string) =>
    report.sweeps[key].map((p, i) => `${i ? "L" : "M"}${sx(p.threshold).toFixed(1)},${sy(p.f1).toFixed(1)}`).join("");
  const at = (key: string, t: number) => report.sweeps[key].find((p) => p.threshold === t);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="F1 score by alert threshold for Satark and RapidFuzz"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          const t = Math.round(x0 + ((x - pad.l) / (width - pad.l - pad.r)) * (x1 - x0));
          setHover(t >= x0 && t <= x1 ? t : null);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={sy(v) + 3} textAnchor="end">{v.toFixed(2)}</text>
          </g>
        ))}
        {[50, 60, 70, 80, 90, 99].map((t) => (
          <text key={t} x={sx(t)} y={height - 10} textAnchor="middle">{t}</text>
        ))}
        {lines.map((key) => {
          const chosen = report.systems[key].threshold;
          return <line key={`c-${key}`} x1={sx(chosen)} x2={sx(chosen)} y1={pad.t} y2={height - pad.b} stroke={`var(--series-${key})`} strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />;
        })}
        {lines.map((key) => (
          <path key={key} d={path(key)} fill="none" stroke={`var(--series-${key})`} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {lines.map((key) => {
          const last = report.sweeps[key][report.sweeps[key].length - 1];
          const peak = report.sweeps[key].reduce((a, b) => (b.f1 > a.f1 ? b : a));
          return (
            <g key={`l-${key}`}>
              <circle cx={sx(peak.threshold)} cy={sy(peak.f1)} r={4} fill={`var(--series-${key})`} stroke="var(--surface)" strokeWidth={2} />
              <text x={sx(last.threshold) + 8} y={sy(last.f1) + 3} style={{ fill: "var(--ink)" }}>
                {key === "satark" ? "Satark" : "RapidFuzz"}
              </text>
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--muted)" strokeWidth={1} />
            {lines.map((key) => {
              const p = at(key, hover);
              return p ? <circle key={key} cx={sx(hover)} cy={sy(p.f1)} r={4} fill={`var(--series-${key})`} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
        <text x={width - pad.r} y={height - 10} textAnchor="end">threshold →</text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${Math.min(70, (sx(hover) / width) * 100)}%`, top: 8 }}>
          <div className="label">threshold {hover}</div>
          {lines.map((key) => {
            const p = at(key, hover);
            return p ? (
              <div key={key} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <span>
                  <i className={`sys-${key}`} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 5 }} />
                  {key === "satark" ? "Satark" : "RapidFuzz"}
                </span>
                <span className="mono">
                  F1 {p.f1.toFixed(3)} · P {p.precision.toFixed(2)} · R {p.recall.toFixed(2)}
                </span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export default function Evaluation() {
  const { data: report, error } = useLoad(() => api.evaluation());

  if (error) return <ErrorNote message={error} />;
  if (!report) return <div className="empty">Loading benchmark…</div>;

  const transforms = Object.keys(report.systems.satark.per_transform);
  const satark = report.systems.satark;
  const fuzzy = report.systems.rapidfuzz;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Matching benchmark</h1>
          <p>
            {report.cases.total.toLocaleString("en-IN")} synthetic queries built from real list names ({report.watchlist_entities.toLocaleString("en-IN")} entities), half positives rewritten the way Indian records mangle names and half people who are not listed. {report.method}
          </p>
        </div>
        <span className="small faint mono">generated {report.generated_at.replace("T", " ")}</span>
      </div>

      <div className="stat-row">
        <div>
          <b>{satark.f1.toFixed(3)}</b>
          <span>Satark F1 · RapidFuzz {fuzzy.f1.toFixed(3)}</span>
        </div>
        <div>
          <b>{pct(satark.recall)}</b>
          <span>recall at threshold {satark.threshold}</span>
        </div>
        <div>
          <b>{pct(satark.false_positive_rate)}</b>
          <span>unlisted people flagged · RapidFuzz {pct(fuzzy.false_positive_rate)}</span>
        </div>
        <div>
          <b>{satark.latency_ms?.p95} ms</b>
          <span>p95 screening latency · p50 {satark.latency_ms?.p50} ms</span>
        </div>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Method</th>
              <th style={{ textAlign: "right" }}>Threshold</th>
              <th style={{ textAlign: "right" }}>Precision</th>
              <th style={{ textAlign: "right" }}>Recall</th>
              <th style={{ textAlign: "right" }}>F1</th>
              <th style={{ textAlign: "right" }}>False-positive rate</th>
              <th style={{ textAlign: "right" }}>Top-1</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEMS.map((s) => {
              const m = report.systems[s.key];
              return (
                <tr key={s.key}>
                  <td>
                    <i className={`sys-${s.key}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 6 }} />
                    <b>{s.label}</b>
                  </td>
                  <td className="small muted">{s.note}</td>
                  <td className="num">{m.threshold}</td>
                  <td className="num">{m.precision.toFixed(3)}</td>
                  <td className="num">{m.recall.toFixed(3)}</td>
                  <td className="num">{m.f1.toFixed(3)}</td>
                  <td className="num">{pct(m.false_positive_rate)}</td>
                  <td className="num">{m.top1_accuracy.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="panel panel-pad stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Correct outcome by query type</h2>
            <div className="legend">
              {SYSTEMS.map((s) => (
                <span key={s.key}>
                  <i className={`sys-${s.key}`} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <p className="small muted">Positives: the listed entity is flagged. Not-listed rows: nothing is flagged.</p>
          <div>
            {transforms.map((t) => (
              <div key={t} className="recall-row">
                <span className="small">{TRANSFORM_LABEL[t] ?? t}</span>
                <div className="recall-bars">
                  {SYSTEMS.map((s) => {
                    const v = report.systems[s.key].per_transform[t] ?? 0;
                    return (
                      <div key={s.key} className="recall-bar" title={`${s.label} · ${TRANSFORM_LABEL[t] ?? t}: ${pct(v)}`}>
                        <div className="recall-track">
                          <i className={`sys-${s.key}`} style={{ width: `${v * 100}%` }} />
                        </div>
                        <span>{Math.round(v * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="panel panel-pad stack">
            <h2>F1 across alert thresholds</h2>
            <p className="small muted">Dashed lines mark the threshold each system picked on the dev half. Hover for precision and recall.</p>
            <SweepChart report={report} />
          </div>
          <div className="panel panel-pad stack">
            <h2>Where Satark still misses</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Listed as</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Best score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.satark_misses.slice(0, 8).map((miss, i) => (
                    <tr key={i}>
                      <td className={/[ऀ-ॿ]/.test(miss.query) ? "deva" : undefined}>{miss.query}</td>
                      <td>{miss.expected}</td>
                      <td className="small muted">{TRANSFORM_LABEL[miss.transform] ?? miss.transform}</td>
                      <td className="num">{miss.top_score?.toFixed(1) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
