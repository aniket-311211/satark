import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router";
import { ArrowUpRight, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandMenu } from "@/components/satark/command-menu";
import { Mark } from "@/components/satark/mark";
import { NAV } from "@/components/satark/nav";
import { q } from "@/lib/api";
import { DEMO_USERS, useIdentity, type DemoUserId } from "@/lib/identity";
import { cn } from "@/lib/utils";

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const cases = useQuery(q.cases("open"));
  const pending = useQuery(q.cases("pending_approval"));
  const counts: Record<string, number | undefined> = { "/queue": (cases.data?.total ?? 0) + (pending.data?.total ?? 0) || undefined };
  return (
    <nav aria-label="Console" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink key={to} to={to} end={"end" in rest} onClick={onNavigate}
          className={({ isActive }) => cn(
            "group flex h-9 items-center gap-2.5 rounded-full px-3 text-sm text-ink-2 transition-colors duration-150 hover:bg-sidebar-accent hover:text-ink",
            isActive && "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--rule)]",
          )}>
          {({ isActive }) => (
            <>
              <Icon className={cn("size-4 shrink-0", isActive ? "text-signal" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
              <span className="truncate">{label}</span>
              {counts[to] !== undefined && <span className="ml-auto font-mono text-xs tabular text-ink-2">{counts[to]}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function IdentitySwitch() {
  const { user, setUser } = useIdentity();
  return (
    <div className="space-y-1.5">
      <p id="acting-as" className="px-1 text-xs text-ink-2">Acting as (demo identity)</p>
      <Select value={user} onValueChange={(v) => setUser(v as DemoUserId)}>
        <SelectTrigger aria-labelledby="acting-as" className="h-9 w-full rounded-full border-rule-strong bg-surface">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_USERS.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.label} <span className="text-ink-3">· {u.role}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Brand() {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-full px-2 py-1 text-ink" aria-label="Satark home">
      <Mark className="h-6" />
      <span className="font-display text-xl tracking-tight">Satark</span>
    </a>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const stats = useQuery(q.stats());
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-surface">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <Brand />
        <SideNav />
        <div className="mt-auto space-y-4">
          <IdentitySwitch />
          <a href="/" className="flex items-center gap-1 px-1 text-xs text-ink-2 hover:text-ink">
            About Satark <ArrowUpRight className="size-3" aria-hidden />
          </a>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-rule bg-background/95 px-4 backdrop-blur-sm md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="lg:hidden"><Brand /></div>
          <button type="button" onClick={() => setCommandOpen(true)}
            className="ml-auto flex h-9 w-full min-w-0 max-w-sm cursor-pointer items-center gap-2 rounded-full border border-rule-strong bg-surface px-3.5 text-sm text-ink-3 transition-colors duration-150 hover:text-ink-2 md:ml-0"
            aria-label="Search or screen a name">
            <Search className="size-4" aria-hidden />
            <span className="truncate">Screen a name or find a customer</span>
            <kbd className="ml-auto hidden rounded-md border border-rule px-1.5 font-mono text-[11px] text-ink-2 sm:inline">⌘K</kbd>
          </button>
          <p className="ml-auto hidden text-xs text-ink-2 xl:block">
            {stats.data ? <><span className="tabular text-ink">{stats.data.entities.toLocaleString("en-IN")}</span> list entries · <span className="tabular text-ink">{stats.data.customers.toLocaleString("en-IN")}</span> customers</> : " "}
          </p>
        </div>
        <main id="main" className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col gap-6">
            <Brand />
            <SideNav onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto"><IdentitySwitch /></div>
          </div>
        </SheetContent>
      </Sheet>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
