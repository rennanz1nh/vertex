"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TikTokShopAutomationTabs } from "@/components/tiktok-shop/TikTokShopAutomationTabs";
import { startTikTokShopReconnect, TikTokShopConnectionButton } from "@/components/tiktok-shop/TikTokShopConnectionButton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Link2, Loader2, Truck } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type ShippingProvider = { id: string; name: string };

export default function TikTokShopSettings() {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean; shopName?: string; sellerName?: string; lastConnected?: string; lastRefreshError?: string;
  } | null>(null);

  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingProviderId, setShippingProviderId] = useState("");
  const [shipping, setShipping] = useState(false);
  const [shipResult, setShipResult] = useState<{ ok: boolean; message: string } | null>(null);

  const functionsBase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tiktok-shop-webhook`
    : "<SUPABASE_URL>/functions/v1/tiktok-shop-webhook";

  useEffect(() => {
    authedFetch("/api/tiktok-shop/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ connected: false }));
    authedFetch("/api/tiktok-shop/shipping-providers").then((r) => r.json()).then((d) => setProviders(d.providers ?? [])).catch(() => {});
  }, []);

  async function handleShip() {
    setShipping(true);
    setShipResult(null);
    try {
      const res = await authedFetch("/api/tiktok-shop/orders/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, trackingNumber, shippingProviderId }),
      });
      const data = await res.json();
      if (!res.ok) { setShipResult({ ok: false, message: data.error || "Erro ao marcar como enviado" }); return; }
      setShipResult({ ok: true, message: "Pedido marcado como enviado no TikTok Shop." });
    } catch (e) {
      setShipResult({ ok: false, message: e instanceof Error ? e.message : "Falha na conexão" });
    } finally {
      setShipping(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/TikTok.png" alt="TikTok Shop" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações — TikTok Shop</h1>
            <p className="text-muted-foreground text-sm">Conexão da conta, webhook de pedidos e envio manual de rastreio</p>
          </div>
        </div>
        <div className="ml-auto">
          <TikTokShopConnectionButton />
        </div>
      </div>

      <TikTokShopAutomationTabs />

      <Card>
        <CardHeader>
          <CardTitle>Conexão da Conta</CardTitle>
          <CardDescription>Status da autorização OAuth com o TikTok Shop Partner Center</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!status ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</div>
          ) : status.connected ? (
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 text-green-600 font-medium"><CheckCircle2 className="h-4 w-4" />Conectado</p>
              {status.shopName && <p>Loja: <span className="font-medium">{status.shopName}</span></p>}
              {status.sellerName && <p>Vendedor: {status.sellerName}</p>}
              {status.lastConnected && <p className="text-muted-foreground">Última atualização de token: {new Date(status.lastConnected).toLocaleString("pt-BR")}</p>}
              {status.lastRefreshError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{status.lastRefreshError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Nenhuma conta TikTok Shop conectada ainda.</p>
              <Button disabled={connecting} onClick={async () => { setConnecting(true); await startTikTokShopReconnect(toast); setConnecting(false); }}>
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Conectar conta TikTok Shop
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook de Pedidos</CardTitle>
          <CardDescription>Cadastre esta URL no TikTok Shop Partner Center para receber pedidos em tempo real</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>URL do Webhook</Label>
          <Input readOnly value={functionsBase} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground">
            Em Partner Center → App → Webhooks, cadastre esta URL para os eventos <code>order_status_change</code> e{" "}
            <code>package_status_change</code>. Sem isso, os pedidos só chegam pela sincronização manual/agendada na aba Pedidos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />Marcar Pedido como Enviado</CardTitle>
          <CardDescription>Envia o número de rastreio ao TikTok Shop para um pedido específico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <Label>ID do Pedido (TikTok Shop)</Label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="576461..." />
          </div>
          <div className="space-y-1.5">
            <Label>Número de Rastreio</Label>
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="1Z999..." />
          </div>
          <div className="space-y-1.5">
            <Label>Transportadora</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={shippingProviderId}
              onChange={(e) => setShippingProviderId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {providers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <Button onClick={handleShip} disabled={!orderId || !trackingNumber || !shippingProviderId || shipping} className="w-full">
            {shipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Marcar como Enviado
          </Button>
          {shipResult && (
            <Alert variant={shipResult.ok ? "default" : "destructive"}>
              {shipResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{shipResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
