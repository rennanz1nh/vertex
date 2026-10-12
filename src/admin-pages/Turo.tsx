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
  sync_key: string | null;
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

interface TuroStats {
  summary: {
    totalTrips: number;
    completed: number;
    upcoming: number;
    active: number;
    distinctVehicles: number;
    distinctGuests: number;
    avgDurationDays: number;
    fleetSize: number;
    matchedCars: number;
    occupancy30: number;
    repeatGuests: number;
  };
  months: { month: string; trips: number }[];
  topVehicles: { label: string; vehicle_id: string; trips: number; days: number; matched: boolean }[];
  topGuests: { name: string; trips: number }[];
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthLabel(key: string) {
  const [, m] = key.split("-");
  return MONTH_ABBR[Number(m) - 1] ?? key;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
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
  const [copiedBookmark, setCopiedBookmark] = useState(false);
  const [stats, setStats] = useState<TuroStats | null>(null);

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

  async function loadStats() {
    const res = await authedFetch("/api/admin/turo/stats");
    if (res.ok) setStats(await res.json() as TuroStats);
  }

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (connected) loadTrips(tab); }, [connected, tab]);
  useEffect(() => { if (connected) loadStats(); }, [connected]);

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

  // The script probes a few candidate reservation-detail endpoints for one trip id
  // so we can discover where Turo exposes earnings (the feeds carry none).
  const PROBE = `let tid=null;try{const ff=(h.tripHistoryFeeds&&(h.tripHistoryFeeds.list||h.tripHistoryFeeds))||[];for(const m of ff){if(m.trips&&m.trips[0]){tid=m.trips[0].id;break;}}}catch(e){}let probe={tripId:tid,results:{}};if(tid){for(const pu of ['/api/reservation/'+tid,'/api/v2/reservation/'+tid,'/api/reservations/'+tid+'/receipt','/api/v2/reservations/'+tid,'/api/trips/'+tid]){try{const rr=await fetch(pu);probe.results[pu]=rr.ok?await rr.json():rr.status;}catch(e){probe.results[pu]=String(e);}}}`;

  function buildBookmarklet(syncKey: string) {
    return `javascript:(async()=>{try{const[u,h]=await Promise.all([fetch('/api/v2/feeds/upcoming-trips?appMode=HOST').then(r=>r.json()),fetch('/api/v2/feeds/trip-history?driverRoles=HOST').then(r=>r.json())]);${PROBE}const r=await fetch('https://vertexrentalcar.com/api/admin/turo/browser-sync',{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Key':'${syncKey}'},body:JSON.stringify({upcomingData:u,historyData:h,probe:probe})});const d=await r.json();alert(d.synced>0?'✅ '+d.synced+' viagens sincronizadas!':'⚠️ '+JSON.stringify(d));}catch(e){alert('❌ '+e);}})();`;
  }

  async function handleSync() {
    // If we have a sync_key, show the bookmarklet (no need to generate a token)
    if (config?.sync_key) {
      setSyncScript(buildBookmarklet(config.sync_key));
      return;
    }
    // Fallback: generate a one-time token
    setSyncing(true);
    setSyncScript(null);
    try {
      const tokenRes = await authedFetch("/api/admin/turo/sync-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("Não foi possível gerar token de sync");
      const { token } = await tokenRes.json() as { token: string };
      const script = `(async()=>{try{const[u,h]=await Promise.all([fetch('/api/v2/feeds/upcoming-trips?appMode=HOST').then(r=>r.json()),fetch('/api/v2/feeds/trip-history?driverRoles=HOST').then(r=>r.json())]);${PROBE}const r=await fetch('https://vertexrentalcar.com/api/admin/turo/browser-sync',{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Token':'${token}'},body:JSON.stringify({upcomingData:u,historyData:h,probe:probe})});const d=await r.json();alert(d.synced>0?'✅ '+d.synced+' viagens sincronizadas!':'⚠️ '+JSON.stringify(d));}catch(e){alert('❌ '+e);}})();`;
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

  async function handleCopyBookmark() {
    if (!config?.sync_key) return;
    await navigator.clipboard.writeText(buildBookmarklet(config.sync_key));
    setCopiedBookmark(true);
    setTimeout(() => setCopiedBookmark(false), 2000);
  }

  async function handleSyncDone() {
    setSyncScript(null);
    await Promise.all([loadConfig(), loadTrips(tab), loadStats()]);
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
                      {totalEarnings > 0 ? `$${totalEarnings.toFixed(2)}` : "Em breve"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config?.last_synced_at ? `Sync: ${fmtDate(config.last_synced_at)}` : "Nunca sincronizado"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics dashboard */}
          {stats && stats.summary.totalTrips > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile label="Ocupação (30d)" value={`${stats.summary.occupancy30}%`} hint={`${stats.summary.matchedCars}/${stats.summary.fleetSize} carros ativos`} />
                <StatTile label="Viagens" value={String(stats.summary.totalTrips)} hint={`${stats.summary.active} ativas · ${stats.summary.upcoming} futuras`} />
                <StatTile label="Duração média" value={`${stats.summary.avgDurationDays}d`} hint={`${stats.summary.distinctVehicles} veículos`} />
                <StatTile label="Hóspedes" value={String(stats.summary.distinctGuests)} hint={`${stats.summary.repeatGuests} recorrentes`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly volume */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Viagens por mês (12 meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const max = Math.max(1, ...stats.months.map(m => m.trips));
                      return (
                        <div className="flex items-end gap-1.5 h-32">
                          {stats.months.map(m => (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{m.trips || ""}</span>
                              <div
                                className="w-full rounded-t"
                                style={{ height: `${(m.trips / max) * 100}%`, minHeight: m.trips ? 4 : 0, background: "#4338ca" }}
                                title={`${m.month}: ${m.trips}`}
                              />
                              <span className="text-[9px] text-muted-foreground">{monthLabel(m.month)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Top vehicles */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Veículos por volume</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(() => {
                      const max = Math.max(1, ...stats.topVehicles.map(v => v.trips));
                      return stats.topVehicles.slice(0, 6).map(v => (
                        <div key={v.vehicle_id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate font-medium flex items-center gap-1.5">
                              {v.label}
                              {!v.matched && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">não cadastrado</Badge>}
                            </span>
                            <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{v.trips} · {v.days}d</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(v.trips / max) * 100}%`, background: v.matched ? "#1b8f6b" : "#94a3b8" }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Top guests */}
              {stats.topGuests.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Hóspedes mais frequentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {stats.topGuests.map(g => (
                        <span key={g.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
                          {g.name}
                          <span className="font-semibold tabular-nums text-muted-foreground">{g.trips}×</span>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p>
                  <strong>Ganhos ($) ainda não disponíveis:</strong> os feeds de viagem do Turo não trazem valores.
                  Estou sondando o endpoint de recibo por reserva no próximo sync para habilitar o painel financeiro.
                </p>
              </div>
            </div>
          )}

          {/* Bookmarklet setup card — always visible when connected */}
          {config?.sync_key && (
            <Card className="border-indigo-200 bg-indigo-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-indigo-900 text-sm font-semibold">
                  <Terminal className="h-4 w-4" /> Sincronização via Bookmarklet
                </CardTitle>
                <CardDescription className="text-indigo-700 text-xs">
                  Arraste o botão abaixo para sua barra de favoritos. Quando quiser sincronizar, vá ao turo.com e clique nele.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Draggable bookmarklet link */}
                  <a
                    href={buildBookmarklet(config.sync_key)}
                    onClick={e => e.preventDefault()}
                    draggable
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md cursor-grab select-none"
                    title="Arraste para a barra de favoritos"
                  >
                    <Image src="/turo-logo.png" alt="" width={32} height={12} className="object-contain brightness-0 invert" />
                    Sync Turo
                  </a>
                  <span className="text-xs text-indigo-600">← arraste para os favoritos</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopyBookmark}>
                    {copiedBookmark ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedBookmark ? "Copiado!" : "Copiar link"}
                  </Button>
                </div>
                <p className="text-xs text-indigo-500">
                  Precisa estar logado em turo.com. O token é permanente — não expira nem precisa ser renovado.
                </p>
              </CardContent>
            </Card>
          )}

          {/* One-time script fallback — shown when bookmarklet not used yet */}
          {syncScript && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                  <Terminal className="h-5 w-5" /> Executar Sync Agora
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Cole este script no console do turo.com (F12 → Console):
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
