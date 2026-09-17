import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ScreenFormValues {
  name: string;
  kind: "" | "person" | "org";
  birth_date: string;
  nationality: string;
  country: string;
}

const KIND_OPTIONS: { value: "any" | "person" | "org"; label: string }[] = [
  { value: "any", label: "Satark decides" },
  { value: "person", label: "Person" },
  { value: "org", label: "Organisation" },
];

/** Name, kind, and the identity attributes the second check can use. All labels are visible; the name error sits next to its field. */
export function ScreenForm({ values, onChange, onSubmit, submitting }: {
  values: ScreenFormValues;
  onChange: (values: ScreenFormValues) => void;
  onSubmit: (values: ScreenFormValues) => void;
  submitting: boolean;
}) {
  const [error, setError] = useState("");
  const set = <K extends keyof ScreenFormValues>(key: K, value: ScreenFormValues[K]) => onChange({ ...values, [key]: value });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Enter a name to screen.");
      return;
    }
    setError("");
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="screen-name" className="label-caps text-ink-3">Name</Label>
          <Input id="screen-name" value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. KUMAR, Anand"
            aria-invalid={!!error} aria-describedby={error ? "screen-name-error" : undefined} required />
          {error && <p id="screen-name-error" className="text-xs text-strong">{error}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screen-kind" className="label-caps text-ink-3">Kind</Label>
          <Select value={values.kind || "any"} onValueChange={(v) => set("kind", v === "any" ? "" : (v as "person" | "org"))}>
            <SelectTrigger id="screen-kind" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screen-dob" className="label-caps text-ink-3">Date of birth</Label>
          <Input id="screen-dob" value={values.birth_date} onChange={(e) => set("birth_date", e.target.value)} placeholder="YYYY-MM-DD or YYYY-MM" className="font-mono" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screen-nationality" className="label-caps text-ink-3">Nationality</Label>
          <Input id="screen-nationality" value={values.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. British" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="screen-country" className="label-caps text-ink-3">Country (ISO-2)</Label>
          <Input id="screen-country" value={values.country} onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))}
            placeholder="IN" maxLength={2} className="font-mono uppercase" />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        <Search aria-hidden /> {submitting ? "Screening…" : "Screen"}
      </Button>
    </form>
  );
}
