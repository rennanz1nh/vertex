import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuroExtras, JsonView, EmptyExtra, fmtDateTime } from "./shared";

export function PayoutTab({ extras }: { extras: TuroExtras | null }) {
  if (extras?.payout == null) return <EmptyExtra label="Método de pagamento" />;

  return (
    <div className="space-y-4">
      {extras.syncedAt && (
        <p className="text-xs text-muted-foreground">Capturado em {fmtDateTime(extras.syncedAt)}</p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Método de pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonView value={extras.payout} />
        </CardContent>
      </Card>
    </div>
  );
}
