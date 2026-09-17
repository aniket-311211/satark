import { Link } from "react-router";
import { PageHeader } from "@/components/satark/page";
import { NAV } from "@/components/satark/nav";

export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="No such function"
        description="This address doesn't map to a function on the console. Pick one from the tabs below, or press its number key."
      />
      <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
        {NAV.map(({ to, key, code, label, icon: Icon }) => (
          <Link key={to} to={to}
            className="group flex flex-col gap-2 bg-panel p-3 transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken">
            <span className="flex items-center justify-between">
              <Icon className="size-4 text-ink-3 group-hover:text-ink-2" aria-hidden />
              <span className="font-mono text-[10.5px] text-ink-3">{key}</span>
            </span>
            <span>
              <span className="label-caps block text-ink-3">{code}</span>
              <span className="text-[13px] text-ink">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
