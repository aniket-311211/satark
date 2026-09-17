import { cn } from "@/lib/utils";

/** The Satark mark: two overlapping checks (name match, identity evidence); the lens where both agree is filled. */
export function Mark({ className, title = "Satark" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 60 38" className={cn("h-6 w-auto", className)} role="img" aria-label={title}>
      <circle cx="22" cy="19" r="14.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="38" cy="19" r="14.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M30 6.907A14.5 14.5 0 0 1 30 31.093A14.5 14.5 0 0 1 30 6.907Z" fill="currentColor" />
    </svg>
  );
}
