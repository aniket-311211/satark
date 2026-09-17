import type { NewsItem } from "@/lib/types";
import { DeskSection } from "./desk-section";

const REGULATORS = ["SEBI", "RBI", "FCA", "NCA"] as const;

/** The regulator desks: SEBI, RBI, FCA and NCA as front-page sections side by side. */
export function RegulatorColumns({ items }: { items: NewsItem[] }) {
  const desks = REGULATORS.map((name) => [name, items.filter((i) => i.publisher === name)] as [string, NewsItem[]]);
  return <DeskSection desks={desks} tone="text-violet" columns="lg:grid-cols-4" />;
}
