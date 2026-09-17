import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Menu, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandMenu } from "@/components/satark/command-menu";
import { Wordmark } from "@/components/satark/mark";
import { NAV } from "@/components/satark/nav";
import { q } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { DEMO_USERS, useIdentity, type DemoUserId } from "@/lib/identity";
import { cn } from "@/lib/utils";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog]") !== null);

/** Number keys 1–8 jump between function tabs, as on a terminal keyboard. */
function useFunctionKeys() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const item = NAV.find((n) => n.key === e.key);
      if (item) { e.preventDefault(); navigate(item.to); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

function FunctionTabs({ onNavigate, vertical = false }: { onNavigate?: () => void; vertical?: boolean }) {
  const cases = useQuery(q.cases("open"));
  const pending = useQuery(q.cases("pending_approval"));
  const queue = (cases.data?.total ?? 0) + (pending.data?.total ?? 0);
  return (
    <nav aria-label="Console" className={cn("flex", vertical ? "flex-col gap-px" : "h-full items-stretch")}>
      {NAV.map(({ to, key, code, short, label, ...rest }) => (
        <NavLink key={to} to={to} end={"end" in rest} onClick={onNavigate} title={label}
          className={({ isActive }) => cn(
            "group relative flex items-center gap-2 text-ink-2 transition-colors duration-150 hover:bg-sunken hover:text-ink",
            vertical ? "h-11 px-3" : "px-2.5 2xl:px-3.5",
            isActive && "bg-panel text-ink",
          )}>
          {({ isActive }) => (
            <>
              <span className={cn("font-mono text-[10.5px] leading-none", isActive ? "text-amber" : "text-ink-3")} aria-hidden>{key}</span>
              <span className={cn("text-[13px] whitespace-nowrap", !vertical && "hidden xl:inline")}>{vertical ? label : short}</span>
              {!vertical && <span className="label-caps xl:hidden" title={label}>{code}</span>}
              {to === "/queue" && queue > 0 && (
                <span className="bg-amber px-1 font-mono text-[10.5px] leading-4 text-bar" aria-label={`${queue} cases need attention`}>{queue}</span>
              )}
              {isActive && <span className={cn("absolute bg-amber", vertical ? "inset-y-0 left-0 w-0.5" : "inset-x-0 bottom-0 h-0.5")} aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function IdentitySwitch({ compact = false }: { compact?: boolean }) {
  const { user, setUser } = useIdentity();
  return (
    <Select value={user} onValueChange={(v) => setUser(v as DemoUserId)}>
      <SelectTrigger aria-label="Acting as (demo identity)" className={cn("h-8 gap-2 border-rule bg-transparent text-[13px]", compact ? "w-full" : "w-auto [&_[data-slot=select-value]_span]:hidden")}>
        <span className="label-caps text-ink-3">As</span>
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
  );
}

/** London and Mumbai desk clocks: the two markets this book spans. */
function Clocks() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const time = (zone: string) => now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone });
  return (
    <div className="hidden items-center gap-3 font-mono text-[11px] text-ink-2 xl:flex" aria-label="Desk clocks">
      <span><span className="text-ink-3">LON</span> {time("Europe/London")}</span>
      <span><span className="text-ink-3">MUM</span> {time("Asia/Kolkata")}</span>
    </div>
  );
}

/** The tape: chain state and live counts on the left, the latest audit events running on the right. */
function Tape() {
  const stats = useQuery(q.stats());
  const verify = useQuery(q.auditVerify());
  const audit = useQuery(q.audit());
  const events = (audit.data ?? []).slice(0, 14);
  const ok = verify.data?.ok;
  return (
    <footer className="sticky bottom-0 z-30 flex h-8 items-stretch border-t border-rule bg-bar text-[11px]" aria-label="Status tape">
      <div className="flex shrink-0 items-center gap-4 border-r border-rule px-3 md:px-4">
        {verify.data && (
          <span className={cn("inline-flex items-center gap-1.5", ok ? "text-cleared" : "text-strong")}>
            {ok ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldAlert className="size-3.5" aria-hidden />}
            <span className="label-caps">{ok ? "Chain intact" : "Chain broken"}</span>
            <span className="hidden font-mono text-ink-3 sm:inline">{verify.data.head?.slice(0, 8)}</span>
          </span>
        )}
        {stats.data && (
          <span className="hidden font-mono text-ink-2 md:inline">
            <span className="text-ink">{fmtInt(stats.data.entities)}</span> entries · <span className="text-ink">{fmtInt(stats.data.customers)}</span> customers
          </span>
        )}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden" aria-hidden>
        {events.length > 0 && (
          <div className="tape-run flex h-full w-max items-center gap-8 pl-4 font-mono whitespace-nowrap text-ink-2">
            {[...events, ...events].map((e, i) => (
              <span key={i}>
                <span className="text-ink-3">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>{" "}
                <span className="text-ink">{e.action}</span> {e.target} <span className="text-ink-3">by {e.actor}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  useFunctionKeys();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-amber focus:px-3 focus:py-1.5 focus:text-bar">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-12 items-stretch border-b border-rule bg-bar">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"
          className="grid w-12 cursor-pointer place-items-center border-r border-rule text-ink-2 hover:bg-sunken hover:text-ink lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
        <a href="/" className="flex shrink-0 items-center border-r border-rule px-4" aria-label="Satark home">
          <Wordmark />
        </a>
        <div className="hidden min-w-0 lg:flex">
          <FunctionTabs />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-3 px-3 md:px-4">
          <button type="button" onClick={() => setCommandOpen(true)} aria-label="Screen a name or find a customer"
            className="flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 border border-rule bg-paper px-2.5 text-[13px] text-ink-3 transition-colors duration-150 hover:border-rule-strong hover:text-ink-2 sm:w-52 lg:w-auto 2xl:w-64">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate lg:hidden 2xl:inline">Screen a name…</span>
            <kbd className="ml-auto hidden border border-rule px-1 text-[10.5px] text-ink-2 sm:inline">⌘K</kbd>
          </button>
          <Clocks />
          <div className="hidden md:block"><IdentitySwitch /></div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>
      <Tape />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 border-rule bg-bar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex h-12 items-center border-b border-rule px-4"><Wordmark /></div>
            <FunctionTabs vertical onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto border-t border-rule p-3"><IdentitySwitch compact /></div>
          </div>
        </SheetContent>
      </Sheet>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
