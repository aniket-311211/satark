import { useCallback, useEffect, useState } from "react";
import { api, type Stats } from "./api";
import Alerts from "./pages/Alerts";
import Audit from "./pages/Audit";
import Customers from "./pages/Customers";
import Evaluation from "./pages/Evaluation";
import Media from "./pages/Media";
import Monitoring from "./pages/Monitoring";
import Screen from "./pages/Screen";

const PAGES = [
  { id: "screen", label: "Screen", layer: "A·T" },
  { id: "alerts", label: "Review queue", layer: "R" },
  { id: "monitoring", label: "Monitoring", layer: "S·R" },
  { id: "media", label: "Adverse media", layer: "A" },
  { id: "customers", label: "Customers", layer: "" },
  { id: "evaluation", label: "Benchmark", layer: "" },
  { id: "audit", label: "Audit trail", layer: "" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

const currentPage = (): PageId => {
  const hash = window.location.hash.replace("#", "");
  return (PAGES.find((p) => p.id === hash)?.id ?? "screen") as PageId;
};

export default function App() {
  const [page, setPage] = useState<PageId>(currentPage);
  const [stats, setStats] = useState<Stats | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStats = useCallback(() => {
    api
      .stats()
      .then((s) => {
        setStats(s);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  const changed = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadStats();
    const timer = window.setInterval(loadStats, 8000);
    const onHash = () => setPage(currentPage());
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("hashchange", onHash);
    };
  }, [loadStats]);

  const go = (id: PageId) => {
    window.location.hash = id;
    setPage(id);
  };

  const open = stats?.alerts_by_status.open ?? 0;

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <b>SATARK</b>
          <span lang="hi">सतर्क</span>
        </div>
        <p className="brand-sub">India-first KYC screening</p>
        <nav className="nav" aria-label="Sections">
          {PAGES.map((p) => (
            <button key={p.id} aria-current={page === p.id ? "page" : undefined} onClick={() => go(p.id)}>
              <span>{p.label}</span>
              {p.id === "alerts" && open > 0 ? <span className="count">{open}</span> : <span className="layer">{p.layer}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div>
            <code>S</code>ource · <code>A</code>lign · <code>T</code>riage
          </div>
          <div>
            <code>A</code>dverse media · <code>R</code>eview · <code>K</code>nowledge
          </div>
          <div style={{ marginTop: 8 }}>Watchlist data © OpenSanctions, CC BY-NC 4.0. Not affiliated with any exchange or data vendor.</div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar" aria-live="polite">
          {offline ? (
            <span>
              <span className="dot off" />
              API unreachable. Start it with <code>satark serve</code>.
            </span>
          ) : (
            <>
              <span>
                <span className="dot" />
                <b>{stats?.entities.toLocaleString("en-IN") ?? "…"}</b> list entities
              </span>
              <span>
                <b>{stats?.customers.toLocaleString("en-IN") ?? "…"}</b> customers
              </span>
              <span>
                <b>{open}</b> open alerts
              </span>
              <span>
                bus <b>{stats?.bus ?? "…"}</b>
              </span>
              <span>
                db <b>{stats?.database ?? "…"}</b>
              </span>
              <span>
                extractor <b>{stats ? (stats.llm_enabled ? "claude" : "rules") : "…"}</b>
              </span>
            </>
          )}
        </div>

        {page === "screen" && <Screen onChange={changed} />}
        {page === "alerts" && <Alerts onChange={changed} refreshKey={refreshKey} />}
        {page === "monitoring" && <Monitoring stats={stats} onChange={changed} />}
        {page === "media" && <Media llm={Boolean(stats?.llm_enabled)} />}
        {page === "customers" && <Customers refreshKey={refreshKey} onChange={changed} />}
        {page === "evaluation" && <Evaluation />}
        {page === "audit" && <Audit refreshKey={refreshKey} />}
      </main>
    </div>
  );
}
