import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (name: string) => MONTHS.findIndex((m) => m.toLowerCase() === name.slice(0, 3).toLowerCase());
const pad = (n: string) => n.padStart(2, "0");

/**
 * One dateline format for every feed: "11 Sep 2026" plus the source's own wall-clock time when it gives one.
 * Feeds publish RFC 2822 ("Thu, 17 Sep 2026 05:30:00 +0530"), SEBI's "10 Sep, 2026 +0530", FCA's
 * "Thursday, August 6, 2026 - 11:25" and ISO; anything unreadable falls back to the day it was indexed.
 */
export function when(published: string | null | undefined, fetchedAt: string): { date: string; time?: string } {
  const s = (published ?? "").trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return { date: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`, time: m[4] ? `${m[4]}:${m[5]}` : undefined };
  m = s.match(/(\d{1,2}) ([A-Za-z]{3,9}),? (\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (m && month(m[2]) >= 0) return { date: `${Number(m[1])} ${MONTHS[month(m[2])]} ${m[3]}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : undefined };
  m = s.match(/([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})(?:\D{1,4}(\d{1,2}):(\d{2}))?/);
  if (m && month(m[1]) >= 0) return { date: `${Number(m[2])} ${MONTHS[month(m[1])]} ${m[3]}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : undefined };
  const f = fetchedAt.match(/(\d{4})-(\d{2})-(\d{2})/);
  return { date: f ? `${Number(f[3])} ${MONTHS[Number(f[2]) - 1]} ${f[1]}` : "Date unknown" };
}

export function Dateline({ published, fetchedAt, className }: { published: string | null | undefined; fetchedAt: string; className?: string }) {
  const { date, time } = when(published, fetchedAt);
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {date}
      {time && time !== "00:00" && <> · <span className="font-mono">{time}</span></>}
    </span>
  );
}
