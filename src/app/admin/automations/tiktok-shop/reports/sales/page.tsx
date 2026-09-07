"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle, Loader2, DollarSign, ShoppingCart, Percent } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";
import { TikTokShopAutomationTabs } from "@/components/tiktok-shop/TikTokShopAutomationTabs";
import { TikTokShopConnectionButton } from "@/components/tiktok-shop/TikTokShopConnectionButton";

type SalesSeriesPoint = { date: string; revenue: number; orders: number; fees: number };
type SalesReport = { series: SalesSeriesPoint[]; totals: { revenue: number; orders: number; fees: number } };

export default function TikTokShopSalesReport() {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch("/api/tiktok-shop/reports/sales")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setReport(d);
      })
      .catch(() => setError("Falha na conexão ao carregar relatório"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/TikTok.png" alt="TikTok Shop" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Vendas — TikTok Shop</h1>
            <p className="text-muted-foreground text-sm">Últimos 30 dias, calculado a partir dos pedidos já sincronizados</p>
          </div>
        </div>
        <div className="ml-auto">
          <TikTokShopConnectionButton />
        </div>
      </div>

      <TikTokShopAutomationTabs />

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
              <CardContent className="pt-6 flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
                <div><p className="text-2xl font-bold">${report.totals.revenue.toFixed(2)}</p><p className="text-xs text-muted-foreground">Receita (30 dias)</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                <div><p className="text-2xl font-bold">{report.totals.orders}</p><p className="text-xs text-muted-foreground">Pedidos (30 dias)</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Percent className="h-8 w-8 text-muted-foreground" />
                <div><p className="text-2xl font-bold">${report.totals.fees.toFixed(2)}</p><p className="text-xs text-muted-foreground">Taxas TikTok Shop (30 dias)</p></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Receita por Dia</CardTitle>
              <CardDescription>Pedidos com canal = TikTok Shop, agrupados por data do pedido</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {report.series.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Nenhum pedido do TikTok Shop nos últimos 30 dias</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.series}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="revenue" fill="#000" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
