"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle, Save, Play, FileText, ListChecks, Search,
  CheckCircle2, XCircle, Link2, Loader2, Trash2, ShieldQuestion, AlertTriangle,
} from "lucide-react";
import { GoogleShoppingAutomationTabs } from "@/components/google-shopping/GoogleShoppingAutomationTabs";
import { computeSyncStatus } from "@/lib/sync-status";
import { authedFetch } from "@/lib/admin-fetch";

type GoogleProduct = {
  sku: string;
  title: string;
  price: number;
  stock: number;
  googleStatus: "approved" | "disapproved" | "not_synced";
  issues: { code: string; description: string; severity: string }[];
};

type ProductResult = { sku: string; title: string; status: "ok" | "error"; error?: string };

type ExecutionLog = {
  id: string;
  date: string;
  mode: "test" | "full" | "select";
  trigger: "manual" | "scheduled";
  status: "success" | "partial" | "error";
  total: number;
  synced: number;
  error?: string;
  products: ProductResult[];
};

function StatusBadge({ status }: { status: GoogleProduct["googleStatus"] }) {
  if (status === "approved") {
    return <Badge className="bg-green-100 text-green-700 border-green-300 gap-1"><CheckCircle2 className="h-3 w-3" />Aprovado</Badge>;
  }
  if (status === "disapproved") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Reprovado</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><ShieldQuestion className="h-3 w-3" />Não sincronizado</Badge>;
}

export default function GoogleShoppingSync() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [runTime, setRunTime] = useState("09:00");
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isConnected, setIsConnected] = useState(false);
  const [dataSourceReady, setDataSourceReady] = useState(false);
  const [activeAction, setActiveAction] = useState<"test" | "full" | "select" | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [products, setProducts] = useState<GoogleProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [statusesError, setStatusesError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [merchantId, setMerchantId] = useState("");
  const [developerEmail, setDeveloperEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [removingSku, setRemovingSku] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{
    at: string | null; status: "success" | "partial" | "error" | null; total: number | null; synced: number | null; error: string | null;
  } | null>(null);

  useEffect(() => {
    authedFetch("/api/google-shopping/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) {
          setIsConnected(true);
          setDataSourceReady(!!d.dataSourceReady);
        }
      })
      .catch(() => {});

    authedFetch("/api/google-shopping/sync-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.settings) return;
        setIsEnabled(!!d.settings.enabled);
        setRunTime(d.settings.run_time || "09:00");
        setActiveWeekdays(
          Array.isArray(d.settings.active_weekdays) && d.settings.active_weekdays.length > 0
            ? d.settings.active_weekdays
            : [0, 1, 2, 3, 4, 5, 6]
        );
        setLastRun({
          at: d.settings.last_run_at,
          status: d.settings.last_run_status,
          total: d.settings.last_run_total,
          synced: d.settings.last_run_synced,
          error: d.settings.last_run_error,
        });
      })
      .catch(() => {});

    authedFetch("/api/google-shopping/sync-logs")
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d.logs)) return;
        setLogs(
          d.logs.map((row: any): ExecutionLog => ({
            id: row.id,
            date: new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            mode: row.mode,
            trigger: row.trigger,
            status: row.status,
            total: row.total ?? 0,
            synced: row.synced ?? 0,
            error: row.error ?? undefined,
            products: row.products ?? [],
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isConnected) fetchProducts();
  }, [isConnected]);

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const res = await authedFetch("/api/google-shopping/products");
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error || "Erro ao buscar produtos");
        return;
      }
      setProducts(data.products || []);
      setStatusesError(data.statusesError || null);
    } catch {
      setConnectionError("Falha na conexão ao buscar produtos");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectionError("");
    try {
      const res = await authedFetch("/api/google-shopping/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: merchantId.trim(), developerEmail: developerEmail.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error || "Erro ao conectar Merchant Center");
        return;
      }
      setIsConnected(true);
      setDataSourceReady(true);
    } catch {
      setConnectionError("Falha na conexão ao conectar Merchant Center");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await authedFetch("/api/google-shopping/sync-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: isEnabled, run_time: runTime, active_weekdays: activeWeekdays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error || "Erro ao salvar configurações");
        return;
      }
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch {
      setConnectionError("Falha na conexão ao salvar configurações");
    } finally {
      setSavingSettings(false);
    }
  }

  const WEEKDAYS = [
    { value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" },
    { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
  ];

  function toggleWeekday(day: number) {
    setActiveWeekdays((prev) => {
      const has = prev.includes(day);
      if (has && prev.length === 1) return prev;
      return has ? prev.filter((d) => d !== day) : [...prev, day].sort();
    });
  }

  async function handleRun(action: "test" | "full" | "select", skus?: string[]) {
    setActiveAction(action);
    try {
      const res = await authedFetch("/api/google-shopping/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMode: action === "test", skus: action === "select" ? skus : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error || "Erro ao executar sincronização");
        return;
      }
      const newLog: ExecutionLog = {
        id: Date.now().toString(),
        date: new Date().toLocaleString("pt-BR"),
        mode: action,
        trigger: "manual",
        status: computeSyncStatus(data.synced, data.total),
        total: data.total,
        synced: data.synced,
        products: data.products,
      };
      setLogs((prev) => [newLog, ...prev]);
      setSelectedLog(newLog);
      if (action === "select") setSelectedSkus(new Set());
      fetchProducts();
    } catch {
      setConnectionError("Falha na conexão com a API");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRemoveProduct(sku: string) {
    setRemovingSku(sku);
    try {
      const res = await authedFetch("/api/google-shopping/remove-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error || "Erro ao remover produto do Google Shopping");
        return;
      }
      fetchProducts();
    } catch {
      setConnectionError("Falha na conexão ao remover produto");
    } finally {
      setRemovingSku(null);
    }
  }

  function toggleSelection(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }

  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/GoogleShopping.svg" alt="Google Shopping" className="h-8 w-8 shrink-0 object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Google Shopping — Sincronização de Produtos</h1>
            <p className="text-muted-foreground text-sm">Mantenha o feed de produtos do Merchant Center espelhando a loja</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" type="button">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sales-channels/GoogleShopping.svg" alt="Google Merchant Center" className="h-4 w-auto object-contain" />
            Google Merchant Center - {isConnected ? "Conectado" : "Não conectado"}
          </Button>
        </div>
      </div>

      <GoogleShoppingAutomationTabs />

      {connectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{connectionError}</AlertDescription>
        </Alert>
      )}

      {!isConnected && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">Conexão necessária</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Não há redirecionamento como no eBay: a Merchant API autentica via service account
                (chave já configurada no servidor, variável <code>GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON</code>).
                Cole abaixo apenas o Merchant Center ID e adicione o e-mail da service account como usuário
                da conta em Merchant Center → Configurações → Acesso à conta antes de conectar.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="merchant-id">Merchant Center ID</Label>
                <Input
                  id="merchant-id"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="developer-email">E-mail do desenvolvedor (só na 1ª vez desse projeto GCP)</Label>
                <Input
                  id="developer-email"
                  type="email"
                  value={developerEmail}
                  onChange={(e) => setDeveloperEmail(e.target.value)}
                  placeholder="voce@gmail.com"
                />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Só preencha se a conexão falhar com &quot;GCP_NOT_REGISTERED&quot; — precisa ser uma conta Google
                  de verdade, não a service account. Depois de registrado uma vez, deixe em branco.
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnect}
              disabled={connecting || !merchantId.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {connecting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando...</>
              ) : (
                <><Link2 className="mr-2 h-4 w-4" />Conectar Merchant Center</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {isConnected && !dataSourceReady && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum data source primário de produtos foi encontrado nessa conta. Crie um em
            Merchant Center → Products → Data sources → Add primary feed → API, depois reconecte.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card className="flex flex-col lg:h-[760px]">
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>Defina como a sincronização automática deve funcionar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 overflow-y-auto flex-1 min-h-0">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="font-semibold">Sincronização Diária</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Reenviar preço/estoque/disponibilidade todo dia</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} className="data-[state=checked]:bg-black" />
            </div>

            <Alert className="border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20">
              <ShieldQuestion className="h-4 w-4" />
              <AlertDescription className="text-sm">
                A Merchant API limita atualizações de produto a cerca de 2x o número de
                ofertas da conta por dia (limite fixo do Google, não aumenta por pedido).
                Por isso a automação roda no máximo 1x por dia — evite rodar &quot;Executar em
                Todos&quot; manualmente no mesmo dia em que a automática já rodou.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label htmlFor="runtime">Horário de Execução</Label>
              <Input id="runtime" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Horário de Brasília (BRT). Execução automática roda 1x por dia numa janela
                aproximada de 1 hora (plano atual da Vercel).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Dias da Semana</Label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map((day) => {
                  const active = activeWeekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeekday(day.value)}
                      className={`h-9 w-12 rounded-md text-xs font-medium border transition-colors ${
                        active ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isEnabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Sincronização automática desativada. Ative para iniciar o agendamento diário.
                </AlertDescription>
              </Alert>
            )}

            {lastRun?.at && (
              <div className="p-3 border rounded-lg space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Última execução automática</p>
                <div className="flex items-center gap-2 text-sm">
                  {lastRun.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-foreground" />
                  ) : lastRun.status === "partial" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span>{new Date(lastRun.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                </div>
                {lastRun.status === "error" && !lastRun.total ? (
                  <p className="text-xs text-destructive">{lastRun.error}</p>
                ) : (
                  <p className={lastRun.status === "success" ? "text-xs text-muted-foreground" : "text-xs text-amber-600"}>
                    {lastRun.synced} de {lastRun.total} produto(s) sincronizado(s)
                  </p>
                )}
              </div>
            )}

            <Button className="w-full bg-black hover:bg-black/80 text-white" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : settingsSaved ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Salvo!</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Salvar Configurações</>
              )}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              disabled={!isConnected || !dataSourceReady || activeAction !== null}
              onClick={() => handleRun("full")}
            >
              {activeAction === "full" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando com o Google...</>
              ) : (
                <><Play className="mr-2 h-4 w-4" />Sincronizar Todos os Produtos</>
              )}
            </Button>

            <Button
              className="w-full"
              variant="ghost"
              disabled={!isConnected || !dataSourceReady || activeAction !== null}
              onClick={() => handleRun("test")}
            >
              {activeAction === "test" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testando...</>
              ) : (
                "Testar com 1 produto"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:h-[760px]">
          <CardHeader>
            <CardTitle>Status dos Produtos no Google</CardTitle>
            <CardDescription>O que já foi aprovado, reprovado (com motivo) ou nunca sincronizado</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 space-y-3">
            {statusesError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Não foi possível consultar o status real no Google ({statusesError}). Os badges &quot;Não sincronizado&quot;
                  abaixo não são confiáveis agora — não significam que o produto realmente falhou, só que essa checagem
                  falhou.
                </AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título ou SKU..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{loadingProducts ? "Carregando..." : `${filteredProducts.length} produto(s) · ${selectedSkus.size} selecionado(s)`}</span>
              <div className="flex gap-3">
                <button type="button" className="underline hover:text-foreground" onClick={() => setSelectedSkus(new Set(filteredProducts.map((p) => p.sku)))}>Selecionar todos</button>
                <button type="button" className="underline hover:text-foreground" onClick={() => setSelectedSkus(new Set())}>Limpar</button>
              </div>
            </div>

            <div className="border rounded-lg overflow-y-auto flex-1 min-h-[280px]">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando produtos...</span>
                </div>
              ) : (
                <>
                  {filteredProducts.map((p) => (
                    <div key={p.sku} className="flex items-start gap-3 p-2.5 border-b last:border-0 hover:bg-muted/30">
                      <Checkbox className="mt-1" checked={selectedSkus.has(p.sku)} onCheckedChange={() => toggleSelection(p.sku)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">SKU: {p.sku} · ${p.price.toFixed(2)} · {p.stock} em estoque</p>
                        {p.issues.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {p.issues.slice(0, 3).map((issue, i) => (
                              <li key={i} className="text-xs text-red-600">{issue.description || issue.code}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <StatusBadge status={p.googleStatus} />
                      <button
                        type="button"
                        title="Remover do Google Shopping"
                        disabled={removingSku === p.sku}
                        onClick={() => handleRemoveProduct(p.sku)}
                        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        {removingSku === p.sku ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado</p>}
                </>
              )}
            </div>

            <Button
              className="w-full bg-black hover:bg-black/80 text-white"
              disabled={selectedSkus.size === 0 || activeAction !== null || !isConnected || !dataSourceReady}
              onClick={() => handleRun("select", [...selectedSkus])}
            >
              {activeAction === "select" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando...</>
              ) : (
                <><ListChecks className="mr-2 h-4 w-4" />Sincronizar {selectedSkus.size} Selecionado(s)</>
              )}
            </Button>

            {!isConnected && <p className="text-xs text-center text-muted-foreground">Conecte o Merchant Center acima para habilitar a execução</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
          <CardDescription>Relatório das últimas sincronizações com o Google Shopping</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><p>Nenhuma execução registrada ainda</p></div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : log.status === "partial" ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{log.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.status === "error" && !log.total ? (log.error || "Falha na execução") : `${log.synced}/${log.total} produtos sincronizados`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{log.trigger === "scheduled" ? "Automático" : "Manual"}</Badge>
                    <Badge variant={log.mode === "full" ? "default" : "outline"} className="text-xs">
                      {log.mode === "test" ? "Teste" : log.mode === "select" ? "Selecionados" : "Completo"}
                    </Badge>
                    {log.total > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />Visualizar Relatório
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Relatório — {selectedLog?.date}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold">{selectedLog.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Produtos</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedLog.synced}</p>
                  <p className="text-xs text-muted-foreground">Sincronizados</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedLog.total - selectedLog.synced}</p>
                  <p className="text-xs text-muted-foreground">Com Erro</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLog.products.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3">
                          <p className="font-medium leading-tight">{p.title}</p>
                          <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                          {p.error && <p className="text-xs text-red-500 mt-0.5">{p.error}</p>}
                        </td>
                        <td className="p-3 text-center">
                          {p.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
