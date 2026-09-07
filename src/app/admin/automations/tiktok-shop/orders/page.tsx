"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TikTokShopAutomationTabs } from "@/components/tiktok-shop/TikTokShopAutomationTabs";
import { startTikTokShopReconnect, TikTokShopConnectionButton } from "@/components/tiktok-shop/TikTokShopConnectionButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Link2, Loader2, RefreshCw } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type TikTokOrder = {
  id: string;
  numero_pedido_canal: string;
  data_pedido: string;
  status: string;
  tiktok_fulfillment_status: string | null;
  total: number;
  shipping_tracking: string | null;
  carrier: string | null;
  buyer_email: string | null;
};

export default function TikTokShopOrders() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [orders, setOrders] = useState<TikTokOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ new: number; updated: number; total: number } | null>(null);

  useEffect(() => {
    if (searchParams.get("tiktok_connected") === "true") {
      setIsConnected(true);
      setStatusLoading(false);
    } else {
      authedFetch("/api/tiktok-shop/status")
        .then((r) => r.json())
        .then((d) => { if (d.connected) setIsConnected(true); })
        .catch(() => {})
        .finally(() => setStatusLoading(false));
    }
    const err = searchParams.get("tiktok_error");
    if (err) setConnectionError(decodeURIComponent(err));

    fetchOrders();
  }, [searchParams]);

  function fetchOrders() {
    setLoadingOrders(true);
    authedFetch("/api/tiktok-shop/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }

  async function handleSync() {
    setSyncing(true);
    setConnectionError("");
    try {
      const { data, error } = await supabase.functions.invoke<{
        new_orders?: number; updated_orders?: number; total_from_tiktok?: number; error?: string;
      }>("tiktok-shop-sync");
      if (error || data?.error) {
        setConnectionError(data?.error || error?.message || "Erro ao sincronizar pedidos");
        return;
      }
      setLastSync({ new: data?.new_orders ?? 0, updated: data?.updated_orders ?? 0, total: data?.total_from_tiktok ?? 0 });
      fetchOrders();
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : "Falha na conexão ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/TikTok.png" alt="TikTok Shop" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos — TikTok Shop</h1>
            <p className="text-muted-foreground text-sm">
              Pedidos chegam automaticamente via webhook; use o botão abaixo para forçar uma sincronização manual.
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <TikTokShopConnectionButton />
        </div>
      </div>

      <TikTokShopAutomationTabs />

      {connectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{connectionError}</AlertDescription>
        </Alert>
      )}

      {!statusLoading && !isConnected && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Autorização necessária</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Conecte sua conta TikTok Shop para começar a sincronizar pedidos, listings e preços.
                </p>
              </div>
              <Button
                className="shrink-0 bg-amber-600 hover:bg-amber-700"
                type="button"
                disabled={connecting}
                onClick={async () => { setConnecting(true); await startTikTokShopReconnect(toast); setConnecting(false); }}
              >
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Conectar conta TikTok Shop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pedidos Sincronizados</CardTitle>
            <CardDescription>Últimos 50 pedidos do TikTok Shop importados para o painel</CardDescription>
          </div>
          <Button variant="outline" onClick={handleSync} disabled={!isConnected || syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar Agora
          </Button>
        </CardHeader>
        <CardContent>
          {lastSync && (
            <p className="text-xs text-muted-foreground mb-3">
              Última sincronização: {lastSync.new} novo(s), {lastSync.updated} atualizado(s) de {lastSync.total} pedido(s) no TikTok Shop.
            </p>
          )}
          {loadingOrders ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando pedidos...</span>
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum pedido do TikTok Shop ainda</p>
          ) : (
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Pedido</th>
                    <th className="text-left p-3 font-medium">Data</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Rastreio</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-3 font-medium">{o.numero_pedido_canal}</td>
                      <td className="p-3 text-muted-foreground">{o.data_pedido}</td>
                      <td className="p-3"><Badge variant="outline">{o.status}</Badge></td>
                      <td className="p-3 text-muted-foreground">{o.shipping_tracking ? `${o.carrier ?? ""} ${o.shipping_tracking}` : "—"}</td>
                      <td className="p-3 text-right font-medium">${Number(o.total ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
