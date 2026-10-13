import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuroExtras, JsonView, EmptyExtra, fmtDateTime } from "./shared";

type EarningsBlob = { hostId?: unknown; years?: Record<string, unknown>; scorecard?: unknown };

export function EarningsTab({ extras }: { extras: TuroExtras | null }) {
  const earnings = extras?.earnings as EarningsBlob | null;
  if (!earnings) return <EmptyExtra label="Ganhos" />;

  const years = earnings.years ?? {};
  const yearKeys = Object.keys(years).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-4">
      {extras?.syncedAt && (
        <p className="text-xs text-muted-foreground">Capturado em {fmtDateTime(extras.syncedAt)}</p>
      )}

      {yearKeys.map((yr) => (
        <Card key={yr}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ganhos {yr}</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView value={years[yr]} />
          </CardContent>
        </Card>
      ))}

      {earnings.scorecard != null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resumo (scorecard)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView value={earnings.scorecard} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
