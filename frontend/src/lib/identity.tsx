import { createContext, useContext, useState, type ReactNode } from "react";

// Demo identities for the maker-checker flow. The API trusts the X-Satark-User header; this is not authentication.
export const DEMO_USERS = [
  { id: "analyst", role: "analyst", label: "Analyst" },
  { id: "reviewer", role: "reviewer", label: "Reviewer" },
  { id: "reviewer2", role: "reviewer", label: "Second reviewer" },
] as const;
export type DemoUserId = (typeof DEMO_USERS)[number]["id"];

const KEY = "satark.actingAs";
let current: DemoUserId = "analyst";
try {
  const saved = localStorage.getItem(KEY);
  if (DEMO_USERS.some((u) => u.id === saved)) current = saved as DemoUserId;
} catch {
  /* storage unavailable: stay on the default identity */
}
export const actingAs = () => current;

const IdentityContext = createContext<{ user: DemoUserId; setUser: (id: DemoUserId) => void }>({ user: current, setUser: () => {} });

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [user, setState] = useState<DemoUserId>(current);
  const setUser = (id: DemoUserId) => {
    current = id;
    setState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };
  return <IdentityContext.Provider value={{ user, setUser }}>{children}</IdentityContext.Provider>;
}

export const useIdentity = () => useContext(IdentityContext);
