// Shared helpers for the eBay "daily bar" charts (Receita por Dia, Impressões/Visualizações
// por Dia) — a two-line X-axis tick (day above, month abbreviation + optional year below)
// and a month-recency opacity ramp so older months fade toward the surface.

const MONTH_ABBR_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseIsoDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function spansMultipleYears(dates: string[]): boolean {
  const years = new Set(dates.map((d) => parseIsoDate(d).year));
  return years.size > 1;
}

/**
 * Ordinal opacity ramp keyed by month: the most recent month a data point falls in
 * renders at full opacity, each older month steps down evenly, floored so the
 * lightest step still clears ~2:1 contrast against the surface (never fades to
 * illegible). A range that never crosses a month boundary returns full opacity for
 * everything — there's nothing to distinguish.
 */
const MIN_MONTH_OPACITY = 0.35;

export function getMonthOpacity(dates: string[]): (date: string) => number {
  const monthKeys = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  const opacityByMonth = new Map<string, number>();
  const lastIndex = monthKeys.length - 1;
  monthKeys.forEach((key, i) => {
    opacityByMonth.set(
      key,
      lastIndex === 0 ? 1 : MIN_MONTH_OPACITY + (i / lastIndex) * (1 - MIN_MONTH_OPACITY)
    );
  });
  return (date: string) => opacityByMonth.get(date.slice(0, 7)) ?? 1;
}

type DateAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value: string };
  showYear: boolean;
};

export function DateAxisTick({ x, y, payload, showYear }: DateAxisTickProps) {
  if (!payload) return null;
  const { year, month, day } = parseIsoDate(payload.value);
  const monthLabel = MONTH_ABBR_PT[month - 1] + (showYear ? `/${String(year).slice(2)}` : "");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))" fillOpacity={0.7}>
        {day}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
        {monthLabel}
      </text>
    </g>
  );
}
