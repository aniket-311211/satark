import { FileClock, Gauge, LayoutDashboard, ListChecks, Newspaper, ScanSearch, ShieldAlert, Users } from "lucide-react";

/** Function tabs: the number is the keyboard shortcut (pressed anywhere outside a text field), the code is the terminal mnemonic. */
export const NAV = [
  { to: "/", key: "1", code: "OVW", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/queue", key: "2", code: "QUE", label: "Review queue", icon: ListChecks },
  { to: "/customers", key: "3", code: "CUS", label: "Customers", icon: Users },
  { to: "/lists", key: "4", code: "LST", label: "Watchlists", icon: ShieldAlert },
  { to: "/news", key: "5", code: "NWS", label: "News desk", icon: Newspaper },
  { to: "/screen", key: "6", code: "SCR", label: "Screen a name", icon: ScanSearch },
  { to: "/benchmark", key: "7", code: "BMK", label: "Benchmark", icon: Gauge },
  { to: "/audit", key: "8", code: "AUD", label: "Audit trail", icon: FileClock },
] as const;
