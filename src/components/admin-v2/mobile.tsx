"use client";

/**
 * Phone-only building blocks for the admin (same structure as the cosmetic admin):
 * a sticky page header with a count and an actions menu, a search box, a scrolling row of
 * filter chips, a divided row list instead of tables, and a floating "Novo" button.
 * Everything here renders only below the `md` breakpoint, so desktop is untouched.
 */
import * as React from "react";
import { MoreHorizontal, Plus, Search, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "13 nov" — compact date for phone rows. Accepts "YYYY-MM-DD" (local) or a full ISO timestamp. */
export function tinyDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${PT_MONTHS[d.getMonth()]}`;
}

export type MobileAction = { label: string; icon?: React.ReactNode; onSelect: () => void; destructive?: boolean };

/** Sticky title bar for phones: title + count, optional "…" menu, then search/chips below. */
export function MobilePageHeader({
  title,
  count,
  actions,
  children,
  sticky = true,
}: {
  title: string;
  count?: number | string;
  actions?: MobileAction[];
  children?: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-4 space-y-2 border-b border-[var(--v2-border)] bg-[var(--v2-bg)] px-4 pb-3 md:hidden",
        sticky && "sticky top-14 z-20 -mt-4 pt-3"
      )}
    >
      <div className="flex items-center gap-2">
        <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">
          {title}
          {count !== undefined && <span className="ml-1.5 text-base font-semibold text-muted-foreground">{count}</span>}
        </h1>
        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              {actions.map((a) => (
                <DropdownMenuItem key={a.label} onSelect={a.onSelect} className={cn(a.destructive && "text-destructive")}>
                  {a.icon && <span className="mr-2 inline-flex h-4 w-4 items-center">{a.icon}</span>}
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {children}
    </div>
  );
}

export function MobileSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 pl-9 pr-9" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground" aria-label="Limpar busca">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Horizontally scrolling chip row (no scrollbar). */
export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>{children}</div>;
}

const chipCls = (on: boolean) =>
  cn(
    "flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-medium",
    on ? "border-foreground bg-foreground text-background" : "bg-background"
  );

export function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={chipCls(on)}>
      {children}
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </button>
  );
}

/** A Select that looks like a chip; highlighted when it's not on its default value. */
export function ChipSelect<T extends string>({
  value,
  onChange,
  options,
  defaultValue,
  placeholder,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  defaultValue?: T;
  placeholder?: string;
}) {
  const on = defaultValue !== undefined && value !== defaultValue;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className={cn("h-8 w-auto shrink-0 gap-1 rounded-full px-3 text-xs font-medium", on && "border-foreground bg-foreground text-background")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Bordered, divided list used instead of tables on phones. */
export function MobileList({ children, empty, isEmpty, className }: { children?: React.ReactNode; empty?: string; isEmpty?: boolean; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card md:hidden", className)}>
      {isEmpty ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty ?? "Nada encontrado"}</p> : <div className="divide-y">{children}</div>}
    </div>
  );
}

/** One tappable list row: leading visual, title + meta lines, badges, trailing value. */
export function MobileRow({
  onClick,
  leading,
  title,
  meta,
  badges,
  trailing,
  trailingSub,
  selected,
  chevron,
}: {
  onClick?: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  trailing?: React.ReactNode;
  trailingSub?: React.ReactNode;
  selected?: boolean;
  chevron?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn("flex items-center gap-3 px-3 py-2.5", interactive && "active:bg-muted/60", selected && "bg-muted/60")}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
        {badges && <div className="mt-1 flex flex-wrap gap-1">{badges}</div>}
      </div>
      {(trailing || trailingSub) && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {trailing && <span className="text-sm font-bold tabular-nums">{trailing}</span>}
          {trailingSub}
        </div>
      )}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );
}

/** Round avatar with initials, or a photo when given. */
export function RowAvatar({ name, src, square }: { name: string; src?: string | null; square?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const shape = square ? "rounded-md" : "rounded-full";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("h-10 w-10 shrink-0 bg-muted object-cover", shape, square && "w-14")} />;
  }
  return <span className={cn("grid h-10 w-10 shrink-0 place-items-center bg-muted text-sm font-bold", shape)}>{initials || "?"}</span>;
}

/** Small pill badge for list rows. */
export function RowBadge({ children, tone = "muted", style }: { children: React.ReactNode; tone?: "muted" | "green" | "amber" | "red" | "blue"; style?: React.CSSProperties }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  } as const;
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", tones[tone])} style={style}>
      {children}
    </span>
  );
}

/** Floating "Novo" button, kept above the bottom tab bar. Adds bottom room so it never covers the last row. */
export function MobileFab({ onClick, label = "Novo" }: { onClick: () => void; label?: string }) {
  return (
    <>
      <div className="h-16 md:hidden" />
      <Button onClick={onClick} className="fixed bottom-[84px] right-4 z-30 h-12 rounded-full px-5 shadow-lg md:hidden">
        <Plus className="mr-1.5 h-5 w-5" /> {label}
      </Button>
    </>
  );
}

/** Two-up stat tiles for phones. */
export function MobileStats({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:hidden">
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card px-3 py-2.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          <p className="truncate text-lg font-bold tabular-nums">{s.value}</p>
          {s.hint && <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}
