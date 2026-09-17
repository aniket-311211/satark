import { cn } from "@/lib/utils";

/**
 * Satark's wordmark. The owner will supply a logo file: swap it in here and every screen follows.
 * The view-transition name lets the landing page's wordmark morph into this one.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[15px] leading-none font-extrabold tracking-[0.16em] text-ink uppercase [font-stretch:125%] [view-transition-name:satark-wordmark]", className)}>
      Satark
    </span>
  );
}
