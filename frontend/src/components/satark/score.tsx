import type { Band } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILL: Record<Band, string> = { strong: "bg-strong", probable: "bg-probable", possible: "bg-possible", weak: "bg-ink-3" };

/** Name-match score on a 0–100 track with the alert threshold marked, so a number is never read without its cut-off. */
export function ScoreMeter({ score, band, threshold = 80, className }: { score: number; band: Band; threshold?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-10 text-right font-mono text-sm tabular text-ink">{score.toFixed(1)}</span>
      <div
        className="relative h-1.5 min-w-20 flex-1 rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={`Name match ${score.toFixed(1)} of 100, alert threshold ${threshold}`}
      >
        <div className={cn("absolute inset-y-0 left-0 rounded-full", FILL[band])} style={{ width: `${Math.min(score, 100)}%` }} />
        <div className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${threshold}%` }} aria-hidden />
      </div>
    </div>
  );
}
