"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Receipt, CheckCircle2, XCircle } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type Billing = { billingAccountName: string | null; billingEnabled: boolean };
type Budget = { name: string; displayName: string; amount: number | null; currency: string | null; thresholdPercents: number[] };

type BillingData = { billing: Billing | null; billingError: string | null; budgets: Budget[]; budgetsError: string | null };

function fmtMoney(amount: number | null, currency: string | null) {
  if (amount === null) return "—";
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function GoogleCloudBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch("/api/google-cloud/billing")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Falha na conexão ao carregar faturamento"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturamento</h1>
          <p className="text-muted-foreground text-sm">
            Status da conta de faturamento e orçamentos configurados. O gasto em tempo real exigiria uma exportação
            de faturamento pro BigQuery (configuração extra no GCP) — não incluído aqui ainda.
          </p>
        </div>
      </div>

      <GoogleCloudAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Conta de faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              {data.billingError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {data.billingError}
                    {data.billingError.includes("403") && (
                      <>
                        {" "}É preciso habilitar a Cloud Billing API no projeto e conceder à conta de serviço o papel{" "}
                        <span className="font-mono">roles/billing.viewer</span> na conta de faturamento (não no projeto —
                        é um nível de permissão separado).
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              ) : data.billing ? (
                <div className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{data.billing.billingAccountName ?? "Nenhuma conta vinculada"}</p>
                  </div>
                  {data.billing.billingEnabled ? (
                    <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Inativo</Badge>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orçamentos configurados</CardTitle>
              <CardDescription>Alertas de orçamento definidos na conta de faturamento (Faturamento → Orçamentos e alertas).</CardDescription>
            </CardHeader>
            <CardContent>
              {data.budgetsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{data.budgetsError}</AlertDescription>
                </Alert>
              ) : data.budgets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum orçamento configurado nesta conta de faturamento.</p>
              ) : (
                <div className="space-y-2">
                  {data.budgets.map((b) => (
                    <div key={b.name} className="border rounded-lg px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{b.displayName}</p>
                        {b.thresholdPercents.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Alertas em {b.thresholdPercents.map((t) => `${Math.round(t * 100)}%`).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold">{fmtMoney(b.amount, b.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
