"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const tooltipStyle = { borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" };

/** useState that remembers the choice in localStorage (only values in `allowed` are accepted). */
export function usePersisted<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null;
      return saved && allowed.includes(saved) ? saved : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set] as const;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="mr-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>}
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors",
            value === o.key ? "border-black bg-black text-white" : "border-input bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A row of option groups shown at the top of a card's body. */
export function OptionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;
}
