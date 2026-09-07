"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, MousePointerClick, Eye, Percent } from "lucide-react";
import { REPORT_PERIODS_90D, type ReportPeriod } from "@/lib/report-periods";
import { GoogleShoppingAutomationTabs } from "@/components/google-shopping/GoogleShoppingAutomationTabs";
import { authedFetch } from "@/lib/admin-fetch";

type PerformanceRow = { offerId: string; title: string; clicks: number; impressions: number; ctr: number };

type PerformanceReport = {
  period: ReportPeriod;
  range: { start: string; end: string };
  clicks: number;
  impressions: number;
  ctr: number;
  products: PerformanceRow[];
};

export default function GoogleShoppingPerformanceReport() {
  const [period, setPeriod] = useState<ReportPeriod>("7d");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/google-shopping/reports/performance?period=${p}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar relatório de performance");
        return;
      }
      setReport(data);
    } catch {
      setError("Falha na conexão ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(period); }, [period, fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Shopping — Performance</h1>
          <p className="text-muted-foreground text-sm">
            Cliques e impressões orgânicas (free listings) por produto — Google não processa o pedido
            diretamente, então isto é visibilidade, não receita.
          </p>
        </div>
        <div className="flex gap-1.5">
          {REPORT_PERIODS_90D.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
                period === p.value ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <GoogleShoppingAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando relatório...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{report.impressions.toLocaleString("pt-BR")}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{report.clicks.toLocaleString("pt-BR")}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CTR</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{report.ctr.toFixed(2)}%</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por Produto</CardTitle>
              <CardDescription>{report.range.start} a {report.range.end}</CardDescription>
            </CardHeader>
            <CardContent>
              {report.products.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Sem dados de performance no período — normal nos primeiros dias após a
                  sincronização, o Google leva um tempo para indexar e mostrar os anúncios.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Produto</th>
                        <th className="text-right p-3 font-medium">Impressões</th>
                        <th className="text-right p-3 font-medium">Cliques</th>
                        <th className="text-right p-3 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.products.map((p) => (
                        <tr key={p.offerId} className="border-t">
                          <td className="p-3">
                            <p className="font-medium leading-tight">{p.title}</p>
                            <p className="text-xs text-muted-foreground">SKU: {p.offerId}</p>
                          </td>
                          <td className="p-3 text-right">{p.impressions.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-right">{p.clicks.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-right">{p.ctr.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
