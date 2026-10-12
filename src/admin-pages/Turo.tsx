"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";
import { RefreshCw, Link2, Link2Off, Car, Calendar, DollarSign, AlertCircle, Copy, Check, Terminal } from "lucide-react";

interface TuroConfig {
  id: string;
  host_id: string | null;
  host_name: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

interface TuroTrip {
  id: string;
  turo_trip_id: string;
  status: string;
  guest_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_id: string;
  pickup_date: string | null;
  return_date: string | null;
  earnings_amount: number | null;
  earnings_currency: string;
  location_city: string;
  location_state: string;
  updated_at: string;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("ongoing")) return <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>;
  if (s.includes("upcoming") || s.includes("reserved") || s.includes("booked")) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Reservado</Badge>;
  if (s.includes("cancel")) return <Badge variant="destructive">Cancelado</Badge>;
  if (s.includes("complete") || s.includes("past")) return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Concluído</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TuroPage() {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<TuroConfig | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [trips, setTrips] = useState<TuroTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tab, setTab] = useState("upcoming");
  const [syncScript, setSyncScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadConfig() {
    const res = await authedFetch("/api/admin/turo/config");
    if (res.ok) {
      const data = await res.json();
      setConnected(data.connected);
      setConfig(data.config);
    }
  }

  async function loadTrips(filter: string) {
    setLoadingTrips(true);
    const res = await authedFetch(`/api/admin/turo/trips?filter=${filter}`);
    if (res.ok) {
      const data = await res.json();
      setTrips(data.trips ?? []);
    }
    setLoadingTrips(false);
  }

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (connected) loadTrips(tab); }, [connected, tab]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/admin/turo/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearer_token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast({ title: "Turo conectado!", description: data.host_name ? `Conta: ${data.host_name}` : "Token salvo com sucesso." });
      setToken("");
      await loadConfig();
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncScript(null);
    try {
      const tokenRes = await authedFetch("/api/admin/turo/sync-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("Não foi possível gerar token de sync");
      const { token } = await tokenRes.json() as { token: string };

      const script = `(async()=>{try{const[u,h]=await Promise.all([fetch('/api/v2/feeds/upcoming-trips?appMode=HOST').then(r=>r.json()),fetch('/api/v2/feeds/trip-history?driverRoles=HOST').then(r=>r.json())]);const r=await fetch('https://vertexrentalcar.com/api/admin/turo/browser-sync',{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Token':'${token}'},body:JSON.stringify({upcomingData:u,historyData:h})});const d=await r.json();console.log(d.synced>0?'✅ Sync OK: '+d.synced+' viagens importadas':'⚠️ Resultado: '+JSON.stringify(d));}catch(e){console.error('❌ Erro:',e);}})();`;

      setSyncScript(script);
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleCopyScript() {
    if (!syncScript) return;
    await navigator.clipboard.writeText(syncScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSyncDone() {
    setSyncScript(null);
    await loadConfig();
    await loadTrips(tab);
    toast({ title: "Dados atualizados!" });
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o Turo? Os dados de viagens salvos serão mantidos.")) return;
    setDisconnecting(true);
    try {
      await authedFetch("/api/admin/turo/config", { method: "DELETE" });
      setConnected(false);
      setConfig(null);
      setTrips([]);
      toast({ title: "Turo desconectado" });
    } finally {
      setDisconnecting(false);
    }
  }

  const upcoming = trips.filter(t => t.pickup_date && new Date(t.pickup_date) >= new Date());
  const history = trips.filter(t => !t.pickup_date || new Date(t.pickup_date) < new Date());
  const displayTrips = tab === "upcoming" ? upcoming : history;
  const totalEarnings = trips.reduce((sum, t) => sum + (t.earnings_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Turo</h1>
          <p className="text-sm text-muted-foreground">Integração com sua conta de host no Turo</p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <Button onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
            <Button onClick={handleDisconnect} disabled={disconnecting} size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Link2Off className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          </div>
        )}
      </div>

      {!connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image src="/turo-logo.png" alt="Turo" width={56} height={20} className="object-contain" /> Conectar conta Turo
            </CardTitle>
            <CardDescription>
              Para conectar, você precisa do seu Bearer Token do Turo. Siga os passos:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-amber-800">Como obter os cookies do Turo:</p>
              </div>
              <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside ml-4">
                <li>Acesse <strong>turo.com</strong> e faça login na sua conta de host</li>
                <li>Abra as Ferramentas do Desenvolvedor (<strong>F12</strong> ou Cmd+Option+I no Mac)</li>
                <li>Vá na aba <strong>Network</strong> (Rede) e recarregue a página</li>
                <li>Clique em qualquer requisição para <strong>turo.com/api/</strong></li>
                <li>Em <strong>Request Headers</strong>, encontre o campo <strong>cookie</strong></li>
                <li>Clique com o botão direito no valor e escolha <strong>"Copy value"</strong></li>
                <li>Cole o <strong>valor completo</strong> no campo abaixo (inclui cf_clearance, access_token, etc.)</li>
              </ol>
              <p className="text-xs text-amber-600 mt-1">💡 Cole <strong>uma única vez</strong> — o sistema renova o token automaticamente. Só será necessário repetir se o Cloudflare bloquear (raro).</p>
            </div>

            <form onSubmit={handleConnect} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cookie Header completo</label>
                <Input
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="cf_clearance=xxx; access_token=eyJ..."
                  className="font-mono text-xs"
                  required
                />
              </div>
              <Button type="submit" disabled={saving || !token.trim()}>
                <Link2 className="mr-2 h-4 w-4" />
                {saving ? "Conectando..." : "Conectar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-1 rounded-lg bg-black">
                    <Image src="/turo-logo.png" alt="Turo" width={60} height={22} className="object-contain" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold text-green-700">Conectado</p>
                    {config?.host_name && <p className="text-xs text-muted-foreground">{config.host_name}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Viagens</p>
                    <p className="font-semibold">{trips.length} registros</p>
                    <p className="text-xs text-muted-foreground">{upcoming.length} próximas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ganhos totais</p>
                    <p className="font-semibold">
                      {totalEarnings > 0
                        ? `$${totalEarnings.toFixed(2)}`
                        : "—"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config?.last_synced_at
                        ? `Sync: ${fmtDate(config.last_synced_at)}`
                        : "Nunca sincronizado"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Console script card — shown after clicking Sincronizar */}
          {syncScript && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                  <Terminal className="h-5 w-5" /> Script de Sincronização
                </CardTitle>
                <CardDescription className="text-blue-700">
                  O Cloudflare bloqueia requisições diretas ao Turo. Execute este script no console do turo.com:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Abra uma aba com <strong>turo.com</strong> (já logado)</li>
                  <li>Pressione <strong>F12</strong> → aba <strong>Console</strong></li>
                  <li>Copie o script abaixo, cole e pressione <strong>Enter</strong></li>
                </ol>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {syncScript}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={handleCopyScript}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span className="ml-1">{copied ? "Copiado!" : "Copiar"}</span>
                  </Button>
                </div>
                <p className="text-xs text-blue-600">
                  ⏱ Token válido por 10 minutos. Após executar o script, clique em:
                </p>
                <Button onClick={handleSyncDone} size="sm">
                  <Check className="mr-2 h-4 w-4" /> Já executei — Atualizar dados
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Trips table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Viagens Turo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma viagem encontrada.</p>
                  <p className="text-sm mt-1">Clique em <strong>Sincronizar</strong> para importar as viagens do Turo.</p>
                </div>
              ) : (
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
                    <TabsTrigger value="history">Histórico ({history.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value={tab}>
                    {loadingTrips ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
                    ) : displayTrips.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma viagem nesta categoria.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Status</th>
                              <th className="pb-2 pr-4 font-medium">Veículo</th>
                              <th className="pb-2 pr-4 font-medium">Hóspede</th>
                              <th className="pb-2 pr-4 font-medium">Retirada</th>
                              <th className="pb-2 pr-4 font-medium">Devolução</th>
                              <th className="pb-2 pr-4 font-medium">Ganhos</th>
                              <th className="pb-2 font-medium">Local</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayTrips.map(trip => (
                              <tr key={trip.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-3 pr-4">{statusBadge(trip.status)}</td>
                                <td className="py-3 pr-4">
                                  <span className="font-medium">
                                    {[trip.vehicle_year, trip.vehicle_make, trip.vehicle_model].filter(Boolean).join(" ") || "—"}
                                  </span>
                                </td>
                                <td className="py-3 pr-4">{trip.guest_name || "—"}</td>
                                <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(trip.pickup_date)}</td>
                                <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(trip.return_date)}</td>
                                <td className="py-3 pr-4">
                                  {trip.earnings_amount ? `$${trip.earnings_amount.toFixed(2)}` : "—"}
                                </td>
                                <td className="py-3">
                                  {[trip.location_city, trip.location_state].filter(Boolean).join(", ") || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
