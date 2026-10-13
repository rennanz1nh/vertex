import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { TuroExtras, JsonView, EmptyExtra, StatTile, fmtMoney, fmtDateTime } from "./shared";

type PayoutBlob = {
  amountOwed?: { amount?: number; currencyCode?: string };
  payoutType?: string;
  achResponse?: { paymentFailed?: boolean; bankAccountNumber?: string };
  payoutStatus?: { status?: string; badge?: { label?: string } };
  accountStatus?: { status?: string };
  nextPaymentDate?: string;
  accountUpdateUrl?: string;
};

export function PayoutTab({ extras }: { extras: TuroExtras | null }) {
  const payout = extras?.payout as PayoutBlob | null;
  if (!payout) return <EmptyExtra label="Método de pagamento" />;

  const owed = payout.amountOwed;
  const statusLabel = payout.payoutStatus?.badge?.label ?? payout.payoutStatus?.status ?? "—";

  return (
    <div className="space-y-4">
      {extras?.syncedAt && <p className="text-xs text-muted-foreground">Capturado em {fmtDateTime(extras.syncedAt)}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile label="A receber" value={fmtMoney(owed?.amount, owed?.currencyCode ?? "USD")} />
        <StatTile label="Próximo pagamento" value={payout.nextPaymentDate ?? "—"} />
        <StatTile label="Método" value={payout.payoutType ?? "—"} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Conta de pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b py-1.5">
            <span className="text-muted-foreground">Tipo</span><span className="font-medium">{payout.payoutType ?? "—"}</span>
          </div>
          {payout.achResponse?.bankAccountNumber && (
            <div className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Conta bancária</span><span className="font-medium font-mono">{payout.achResponse.bankAccountNumber}</span>
            </div>
          )}
          <div className="flex justify-between border-b py-1.5">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-green-100 text-green-800 border-green-200 border">{statusLabel}</Badge>
          </div>
          {payout.achResponse?.paymentFailed != null && (
            <div className="flex justify-between border-b py-1.5">
              <span className="text-muted-foreground">Pagamento falhou?</span><span className="font-medium">{payout.achResponse.paymentFailed ? "Sim" : "Não"}</span>
            </div>
          )}
          {payout.accountUpdateUrl && (
            <a href={payout.accountUpdateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 text-sm pt-1">
              Gerenciar conta no Stripe <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
      </Card>

      <details className="rounded-lg border p-3">
        <summary className="text-sm font-medium cursor-pointer">Dados brutos</summary>
        <div className="mt-2"><JsonView value={payout} /></div>
      </details>
    </div>
  );
}
