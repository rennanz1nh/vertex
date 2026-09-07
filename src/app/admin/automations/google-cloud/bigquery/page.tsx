"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, CheckCircle2, Database, ExternalLink } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type BigQueryLink = { name: string; project: string; createTime?: string; dailyExportEnabled?: boolean };

type BigQueryStatus = {
  configured: boolean;
  propertyId: string | null;
  property: { displayName: string; timeZone: string; currencyCode: string } | null;
  links: BigQueryLink[];
  error?: string | null;
};

type PurchaseRow = { date: string; purchases: number; revenue: number };

function fmtDate(iso: string) {
  // BigQuery DATE values serialize as "YYYY-MM-DD"
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function GoogleCloudBigQueryPage() {
  const [status, setStatus] = useState<BigQueryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [propertyIdInput, setPropertyIdInput] = useState("");
  const [saving, setSaving] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/google-cloud/bigquery");
      const data = await res.json();
      setStatus(data);
      setPropertyIdInput(data.propertyId || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const runQuery = useCallback(async () => {
    setPurchasesLoading(true);
    setPurchasesError("");
    try {
      const res = await authedFetch("/api/google-cloud/bigquery/query?days=7");
      const data = await res.json();
      if (!res.ok) {
        setPurchasesError(data.error || "Erro ao consultar o BigQuery");
        return;
      }
      setPurchases(data.rows);
    } catch {
      setPurchasesError("Falha na conexão ao consultar o BigQuery");
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await authedFetch("/api/google-cloud/bigquery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: propertyIdInput }),
      });
      await fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Status GA4 → BigQuery</h1>
          <p className="text-muted-foreground text-sm">
            Esta tela não consulta o BigQuery nem roda relatórios — ela só confirma se sua propriedade
            GA4 já tem a exportação diária gratuita pro BigQuery vinculada. A configuração em si é feita
            direto no Admin do Google Analytics.
          </p>
        </div>
      </div>

      <GoogleCloudAutomationTabs />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Exportação GA4 → BigQuery</CardTitle>
          <CardDescription>
            Vincule sua propriedade GA4 ao BigQuery em Admin → Links do BigQuery no Google Analytics (gratuito,
            exportação diária). Esta tela só confirma se o link já existe — a configuração em si é feita lá.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ga4-property">Property ID do GA4 (numérico — não é o &quot;G-XXXX&quot;)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ga4-property"
                value={propertyIdInput}
                onChange={(e) => setPropertyIdInput(e.target.value)}
                placeholder="ex: 123456789"
              />
              <Button variant="outline" onClick={handleSave} disabled={saving} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Encontrado em Google Analytics → Administrador → Configurações da propriedade (é o número, não o ID de medição
              &quot;G-XXXX&quot; configurado em{" "}
              <a href="/admin/settings/google" className="underline">
                Configurações &gt; Google
              </a>
              ). A conta de serviço já usada pelo Search Console também precisa ser adicionada como usuária dessa
              propriedade (Administrador → Acesso à propriedade → Adicionar usuários).
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </div>
          ) : status?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          ) : status?.configured && status.property ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Acesso confirmado — propriedade &quot;{status.property.displayName}&quot;
              </div>
              {status.links.length > 0 ? (
                <div className="space-y-2">
                  {status.links.map((l) => (
                    <div key={l.name} className="border rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                      <span>Projeto BigQuery: <span className="font-mono text-xs">{l.project}</span></span>
                      {l.dailyExportEnabled && <Badge className="bg-green-600 hover:bg-green-600">Exportação diária ativa</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum link com o BigQuery configurado ainda para esta propriedade.{" "}
                    <a
                      href={`https://analytics.google.com/analytics/web/#/a/p${status.propertyId}/admin/bigquery-links`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-0.5"
                    >
                      Configurar agora <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Informe o Property ID acima para verificar o status do link com o BigQuery.
            </p>
          )}
        </CardContent>
      </Card>

      {status?.configured && status.links.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Consultar dados brutos</CardTitle>
                <CardDescription>
                  Compras por dia direto da tabela de eventos exportada pelo GA4 — dado que os relatórios prontos
                  do GA4 não mostram sem uma exploração customizada. Cada consulta tem um custo pequeno no BigQuery
                  (grátis até 1 TB/mês); confira a aba Faturamento se for usar isso com frequência.
                </CardDescription>
              </div>
              <Button onClick={runQuery} disabled={purchasesLoading} size="sm" variant="outline" type="button" className="shrink-0">
                {purchasesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Consultar (7 dias)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {purchasesError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{purchasesError}</AlertDescription>
              </Alert>
            ) : purchases === null ? (
              <p className="text-sm text-muted-foreground py-2">Clique em &quot;Consultar&quot; para rodar a query.</p>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma compra registrada no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Data</th>
                      <th className="text-right py-2 px-2 font-medium">Compras</th>
                      <th className="text-right py-2 px-2 font-medium">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((row) => (
                      <tr key={row.date} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">{fmtDate(row.date)}</td>
                        <td className="py-2 px-2 text-right">{row.purchases}</td>
                        <td className="py-2 px-2 text-right">{row.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
