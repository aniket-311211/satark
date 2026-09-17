import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Every number in a chart or figure renders in mono tabular digits; prose around it stays sans. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular text-ink", className)}>{children}</span>;
}

/** The one-line, data-computed takeaway every chart carries beneath it. */
export function Takeaway({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-[62ch] text-[12.5px] leading-snug text-ink-2">{children}</p>;
}

/** Proportional width against a maximum, floored so small-but-real values stay visible. */
export const barPct = (value: number, max: number) => (max <= 0 ? 0 : Math.max(value > 0 ? 3 : 0, (value / max) * 100));

/** Square-root scale so a 1,385-wide first step doesn't flatten a 44-wide last step to nothing. */
export const sqrtPct = (value: number, max: number) => (max <= 0 ? 0 : Math.max(value > 0 ? 4 : 0, (Math.sqrt(value) / Math.sqrt(max)) * 100));
