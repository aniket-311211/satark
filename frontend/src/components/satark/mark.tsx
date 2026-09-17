import { cn } from "@/lib/utils";

/**
 * Satark's logo: the owner's eye-and-magnifier mark with the name, cut out onto transparency in bone
 * (public/brand/satark-logo.png). The view-transition name lets the landing page's logo morph into this one.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <img src="/brand/satark-logo.png" alt="Satark" width={107} height={40}
      className={cn("h-10 w-auto select-none [view-transition-name:satark-wordmark]", className)} draggable={false} />
  );
}
