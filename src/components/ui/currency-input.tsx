import * as React from "react"

import { cn } from "@/lib/utils"

// Some existing records were saved with a "$" the user typed by hand into a plain
// input — strip that off so it doesn't double up with the fixed prefix below.
function stripDollarSign(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.startsWith("$") ? trimmed.slice(1).trim() : trimmed;
}

// Amounts are typed loosely ("6.7", ".5", "6") but should settle into a canonical
// two-decimal value once the field loses focus, so "6.7" reads back as $6.70.
// Returns null when there is nothing to change — empty, not a number, or already
// in the canonical form.
function normalizeAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const fixed = parsed.toFixed(2);
  return fixed === trimmed ? null : fixed;
}

// Text input for monetary values with a fixed, non-editable "$" prefix baked
// into the field itself — the "$" is decoration, never part of the bound value.
const CurrencyInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type: _type, value, defaultValue, onBlur, onChange, ...props }, ref) => {
    // Normalize on blur rather than on every keystroke — reformatting mid-typing
    // would fight the user (typing "6.7" would become "6.70" before the cents).
    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (!props.readOnly && !props.disabled) {
        const normalized = normalizeAmount(event.target.value);
        if (normalized !== null) {
          event.target.value = normalized;
          // Let the form library (or controlling state) hear the corrected value.
          onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>);
        }
      }
      onBlur?.(event);
    };

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground md:text-sm">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-6 pr-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          value={stripDollarSign(value) as string | number | readonly string[] | undefined}
          defaultValue={stripDollarSign(defaultValue) as string | number | readonly string[] | undefined}
          ref={ref}
          onChange={onChange}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
