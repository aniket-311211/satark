import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Building2, ScanSearch, User } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { q } from "@/lib/api";
import { NAV } from "@/components/satark/nav";

/** ⌘K: jump to a screen, open a customer, or screen any name against the lists. */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const customers = useQuery({ ...q.customers(), enabled: open });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle.length < 2) return [];
    return (customers.data?.items ?? []).filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [customers.data, term]);

  const go = (to: string) => {
    onOpenChange(false);
    setTerm("");
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Satark" description="Screen a name, open a customer, or jump to a screen">
      <CommandInput placeholder="Screen a name or find a customer…" value={term} onValueChange={setTerm} />
      <CommandList>
        <CommandEmpty>No customers or screens match.</CommandEmpty>
        {term.trim().length >= 2 && (
          <CommandGroup heading="Screen">
            <CommandItem value={`screen ${term}`} onSelect={() => go(`/screen?name=${encodeURIComponent(term.trim())}`)}>
              <ScanSearch aria-hidden />
              Screen “{term.trim()}” against all five lists
            </CommandItem>
          </CommandGroup>
        )}
        {matches.length > 0 && (
          <CommandGroup heading="Customers">
            {matches.map((c) => (
              <CommandItem key={c.id} value={`customer ${c.id} ${c.name}`} onSelect={() => go(`/customers/${c.id}`)}>
                {c.kind === "org" ? <Building2 aria-hidden /> : <User aria-hidden />}
                <span className="truncate">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV.map((item) => (
            <CommandItem key={item.to} value={`go ${item.label} ${item.code}`} onSelect={() => go(item.to)}>
              <item.icon aria-hidden />
              {item.label}
              <CommandShortcut className="font-mono">{item.key} · {item.code}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
