import { FileClock, Gauge, LayoutDashboard, ListChecks, Newspaper, ScanSearch, ShieldAlert, Users } from "lucide-react";

/**
 * Function tabs: the number is the keyboard shortcut (pressed anywhere outside a text field),
 * the code is the terminal mnemonic, `short` is the tab label and `label` the screen's name after "Satark".
 */
export const NAV = [
  { to: "/", key: "1", code: "OVW", short: "Overview", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/queue", key: "2", code: "QUE", short: "Queue", label: "Queue", icon: ListChecks },
  { to: "/customers", key: "3", code: "CUS", short: "Customers", label: "Customers", icon: Users },
  { to: "/lists", key: "4", code: "LST", short: "Lists", label: "Lists", icon: ShieldAlert },
  { to: "/news", key: "5", code: "NWS", short: "Wire", label: "Wire", icon: Newspaper },
  { to: "/screen", key: "6", code: "SCR", short: "Screen", label: "Screen", icon: ScanSearch },
  { to: "/benchmark", key: "7", code: "BMK", short: "Benchmark", label: "Benchmark", icon: Gauge },
  { to: "/audit", key: "8", code: "AUD", short: "Audit", label: "Audit", icon: FileClock },
] as const;
