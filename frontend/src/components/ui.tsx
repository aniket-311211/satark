import { useCallback, useEffect, useState } from "react";
import type { Band, Match } from "../api";

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    return loader()
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

export function Name({ children }: { children: string }) {
  return <span className={hasDevanagari(children) ? "deva" : undefined}>{children}</span>;
}

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function ScoreBlock({ score, band }: { score: number; band: Band }) {
  return (
    <div className={`score ${band}`} aria-label={`score ${score}, ${band}`}>
      <b>{Math.round(score)}</b>
      <div className="meter" style={{ color: `var(--${band === "weak" ? "faint" : band})` }}>
        <i style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

export const SOURCE_TONE: Record<string, string> = {
  regulatory: "probable",
  pep: "accent",
  terrorism: "strong",
  sanctions: "strong",
  demo: "neutral",
};

export const SOURCE_SHORT: Record<string, string> = {
  in_nse_debarred: "NSE debarred",
  in_sansad: "PEP · Parliament",
  in_mha_banned: "MHA banned",
  un_sc_sanctions: "UN sanctions",
  demo_feed: "Demo feed",
};

export function MatchCard({ match, action }: { match: Match; action?: React.ReactNode }) {
  return (
    <div className="match">
      <ScoreBlock score={match.score} band={match.band} />
      <div className="stack" style={{ gap: 4 }}>
        <div className="match-title">
          <h3>
            <Name>{match.entity_name}</Name>
          </h3>
          <Pill tone={match.band}>{match.band}</Pill>
          <Pill tone="neutral">{SOURCE_SHORT[match.source] ?? match.source}</Pill>
          {match.matched_name !== match.entity_name && (
            <span className="small muted">
              matched alias <Name>{match.matched_name}</Name>
            </span>
          )}
          {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
        </div>
        <div className="pairs">
          {match.pairs.map((pair, i) => (
            <span key={i} className={`pair ${pair.how}`} title={`similarity ${pair.sim}`}>
              <span>{pair.query}</span>
              <span className="how">{pair.how}</span>
              <span>{pair.listed}</span>
            </span>
          ))}
        </div>
        <ul className="reasons">
          {match.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? <div className="error">{message}</div> : null;
}
