import { FileClock, Gauge, LayoutDashboard, ListChecks, Newspaper, ScanSearch, ShieldAlert, Users } from "lucide-react";

export const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/queue", label: "Review queue", icon: ListChecks },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/lists", label: "Watchlists", icon: ShieldAlert },
  { to: "/news", label: "News desk", icon: Newspaper },
  { to: "/screen", label: "Screen a name", icon: ScanSearch },
  { to: "/benchmark", label: "Benchmark", icon: Gauge },
  { to: "/audit", label: "Audit trail", icon: FileClock },
] as const;
