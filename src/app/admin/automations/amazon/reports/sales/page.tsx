"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { AlertCircle, Loader2, DollarSign, ShoppingCart, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/report-periods";
import { formatPrice } from "@/lib/utils";
import { AmazonAutomationTabs } from "@/components/amazon/AmazonAutomationTabs";
import { authedFetch } from "@/lib/admin-fetch";

type SalesReport = {
  period: ReportPeriod;
  range: { start: string; end: string };
  revenue: number;
  orderCount: number;
  unitsSold: number;
  avgOrderValue: number;
  daily: { date: string; revenue: number }[];
  changeVsPrevious: { revenue: number | null; orderCount: number | null; unitsSold: number | null };
};

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">sem dados no período anterior</span>;
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> igual ao período anterior
      </span>
    );
  }
  const positive = rounded > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{rounded}% vs. período anterior
    </span>
  );
}

const chartConfig = { revenue: { label: "Receita", color: "hsl(var(--primary))" } };

export default function AmazonSalesReport() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/amazon/reports/sales?period=${p}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar relatório de vendas");
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
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/Amazon.png" alt="Amazon" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Vendas</h1>
            <p className="text-muted-foreground text-sm">Receita, pedidos e unidades vendidas na Amazon</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
                period === p.value
                  ? "bg-black text-white border-black"
                  : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <AmazonAutomationTabs />

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
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(report.revenue)}</p>
                <ChangeBadge value={report.changeVsPrevious.revenue} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.orderCount}</p>
                <ChangeBadge value={report.changeVsPrevious.orderCount} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unidades Vendidas</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.unitsSold}</p>
                <ChangeBadge value={report.changeVsPrevious.unitsSold} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ticket Médio</CardTitle>
              <CardDescription>Receita dividida pelo número de pedidos no período</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatPrice(report.avgOrderValue)}</p>
            </CardContent>
          </Card>

          {report.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Receita por Dia</CardTitle>
                <CardDescription>{report.range.start} a {report.range.end}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.daily}>
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
