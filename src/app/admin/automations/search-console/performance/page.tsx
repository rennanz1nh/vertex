"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, MousePointerClick, Eye, Percent, ArrowUpDown } from "lucide-react";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/report-periods";
import { SearchConsoleAutomationTabs } from "@/components/search-console/SearchConsoleAutomationTabs";
import { SearchConsoleStatusCard } from "@/components/search-console/SearchConsoleStatusCard";
import { GoogleSearchConsoleLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type Dimension = "query" | "page";

type Row = { key: string; clicks: number; impressions: number; ctr: number; position: number };

type AnalyticsReport = {
  period: ReportPeriod;
  range: { start: string; end: string };
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  dimension: Dimension;
  rows: Row[];
};

export default function SearchConsolePerformancePage() {
  const [period, setPeriod] = useState<ReportPeriod>("7d");
  const [dimension, setDimension] = useState<Dimension>("query");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async (p: ReportPeriod, d: Dimension) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/search-console/analytics?period=${p}&dimension=${d}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar dados do Search Console");
        setReport(null);
        return;
      }
      setReport(data);
    } catch {
      setError("Falha na conexão ao carregar relatório");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(period, dimension); }, [period, dimension, fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleSearchConsoleLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Search Console — Performance</h1>
          <p className="text-muted-foreground text-sm">
            Cliques, impressões e posição média nos resultados de busca do Google. Dados costumam ter
            2-3 dias de atraso.
          </p>
        </div>
      </div>

      <SearchConsoleAutomationTabs />
      <SearchConsoleStatusCard />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1.5">
          {REPORT_PERIODS.map((p) => (
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
        <div className="flex gap-1.5">
          {(["query", "page"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDimension(d)}
              className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
                dimension === d ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {d === "query" ? "Por Termo de Busca" : "Por Página"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando relatório...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Posição Média</CardTitle>
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{report.position.toFixed(1)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{dimension === "query" ? "Termos de Busca" : "Páginas"}</CardTitle>
              <CardDescription>{report.range.start} a {report.range.end}</CardDescription>
            </CardHeader>
            <CardContent>
              {report.rows.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Sem dados no período — normal logo após conectar, o Google leva alguns dias para
                  acumular dados de busca.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">{dimension === "query" ? "Termo de Busca" : "Página"}</th>
                        <th className="text-right p-3 font-medium">Impressões</th>
                        <th className="text-right p-3 font-medium">Cliques</th>
                        <th className="text-right p-3 font-medium">CTR</th>
                        <th className="text-right p-3 font-medium">Posição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r) => (
                        <tr key={r.key} className="border-t">
                          <td className="p-3 max-w-md truncate" title={r.key}>{r.key}</td>
                          <td className="p-3 text-right">{r.impressions.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-right">{r.clicks.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-right">{r.ctr.toFixed(2)}%</td>
                          <td className="p-3 text-right">{r.position.toFixed(1)}</td>
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
