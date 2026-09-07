"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  label: ReactNode;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  textarea?: boolean;
  rows?: number;
};

// A labeled text/textarea field used across the SEO / Google / Facebook tabs.
export function SettingsField({ label, value, onChange, placeholder, hint, textarea, rows = 3 }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-2">{label}</Label>
      {textarea ? (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
