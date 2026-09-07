"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TikTokShopAutomationTabs } from "@/components/tiktok-shop/TikTokShopAutomationTabs";
import { TikTokShopConnectionButton } from "@/components/tiktok-shop/TikTokShopConnectionButton";
import {
  AlertCircle, Save, Play, FileText, ListChecks, Search,
  CheckCircle2, XCircle, Loader2
} from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type TikTokShopListing = { productId: string; skuId: string; title: string; price: number; imageUrl?: string };

type ProductResult = {
  sku: string; title: string; oldPrice: number; newPrice: number; status: "ok" | "error"; error?: string;
};

type ExecutionLog = {
  id: string; date: string; mode: "test" | "full" | "select"; trigger: "manual" | "scheduled";
  status: "success" | "error"; total: number; updated: number; error?: string; products: ProductResult[];
};

export default function TikTokShopPriceAutomation() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [priceAdjustment, setPriceAdjustment] = useState("-0.01");
  const [runTime, setRunTime] = useState("09:00");
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isConnected, setIsConnected] = useState(false);
  const [, setStatusLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<"test" | "full" | "select" | null>(null);
  const [runProgress, setRunProgress] = useState<{ completed: number; total: number } | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [allListings, setAllListings] = useState<TikTokShopListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [listingSearch, setListingSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState<"adjustment" | "fixed">("adjustment");
  const [selectionAdjustment, setSelectionAdjustment] = useState("-0.01");
  const [selectionFixedPrice, setSelectionFixedPrice] = useState("");
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [lastRun, setLastRun] = useState<{
    at: string | null; status: "success" | "error" | null; total: number | null; updated: number | null; error: string | null;
  } | null>(null);

  useEffect(() => {
    authedFetch("/api/tiktok-shop/status")
      .then((r) => r.json())
      .then((d) => { if (d.connected) setIsConnected(true); })
      .catch(() => {})
      .finally(() => setStatusLoading(false));

    authedFetch("/api/tiktok-shop/automation-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.settings) return;
        setIsEnabled(!!d.settings.enabled);
        setRunTime(d.settings.run_time || "09:00");
        setPriceAdjustment(String(d.settings.price_adjustment ?? -0.01));
        setActiveWeekdays(
          Array.isArray(d.settings.active_weekdays) && d.settings.active_weekdays.length > 0
            ? d.settings.active_weekdays : [0, 1, 2, 3, 4, 5, 6]
        );
        setLastRun({
          at: d.settings.last_run_at, status: d.settings.last_run_status,
          total: d.settings.last_run_total, updated: d.settings.last_run_updated, error: d.settings.last_run_error,
        });
      })
      .catch(() => {});

    authedFetch("/api/tiktok-shop/automation-logs")
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d.logs)) return;
        setLogs(d.logs.map((row: any): ExecutionLog => ({
          id: row.id,
          date: new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          mode: row.mode, trigger: row.trigger, status: row.status,
          total: row.total ?? 0, updated: row.updated ?? 0, error: row.error ?? undefined, products: row.products ?? [],
        })));
      })
      .catch(() => {});

    fetchListings();
  }, []);

  useEffect(() => {
    if (activeAction !== "full" && activeAction !== "select") { setRunProgress(null); return; }
    let cancelled = false;
    const poll = () => {
      authedFetch("/api/tiktok-shop/update-price/progress")
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setRunProgress({ completed: d.completed ?? 0, total: d.total ?? 0 }); })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeAction]);

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await authedFetch("/api/tiktok-shop/automation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: isEnabled, run_time: runTime, price_adjustment: parseFloat(priceAdjustment), active_weekdays: activeWeekdays }),
      });
      const data = await res.json();
      if (!res.ok) { setConnectionError(data.error || "Erro ao salvar configurações"); return; }
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

  async function handleRun(action: "test" | "full" | "select", skuIds?: string[]) {
    setActiveAction(action);
    try {
      const isFixedSelection = action === "select" && selectionMode === "fixed";
      const res = await authedFetch("/api/tiktok-shop/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment: action === "select" ? parseFloat(selectionAdjustment) : parseFloat(priceAdjustment),
          fixedPrice: isFixedSelection ? parseFloat(selectionFixedPrice) : undefined,
          testMode: action === "test",
          skuIds: action === "select" ? skuIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setConnectionError(data.error || "Erro ao executar automação"); return; }

      const newLog: ExecutionLog = {
        id: Date.now().toString(), date: new Date().toLocaleString("pt-BR"), mode: action, trigger: "manual",
        status: data.updated > 0 ? "success" : "error", total: data.total, updated: data.updated, products: data.products,
      };
      setLogs((prev) => [newLog, ...prev]);
      setSelectedLog(newLog);
      if (action === "select") setSelectedSkuIds(new Set());
    } catch {
      setConnectionError("Falha na conexão com a API");
    } finally {
      setActiveAction(null);
    }
  }

  async function fetchListings() {
    setLoadingListings(true);
    try {
      const res = await authedFetch("/api/tiktok-shop/listings");
      const data = await res.json();
      if (!res.ok) { setConnectionError(data.error || "Erro ao buscar listings do TikTok Shop"); return; }
      setAllListings(data.listings || []);
    } catch {
      setConnectionError("Falha na conexão ao buscar listings");
    } finally {
      setLoadingListings(false);
    }
  }

  function toggleListingSelection(skuId: string) {
    setSelectedSkuIds((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId); else next.add(skuId);
      return next;
    });
  }

  const filteredListings = allListings.filter((l) => {
    const q = listingSearch.trim().toLowerCase();
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || l.skuId.includes(q);
  });

  const selectionValueInvalid = selectionMode === "adjustment"
    ? selectionAdjustment.trim() === "" || isNaN(parseFloat(selectionAdjustment))
    : selectionFixedPrice.trim() === "" || isNaN(parseFloat(selectionFixedPrice)) || parseFloat(selectionFixedPrice) <= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/sales-channels/TikTok.png" alt="TikTok Shop" className="h-10 w-auto" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Price Automation</h1>
            <p className="text-muted-foreground text-sm">Atualize preços e estoque dos seus SKUs no TikTok Shop automaticamente</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card className="flex flex-col lg:h-[760px]">
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>Defina como a automação deve funcionar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 overflow-y-auto flex-1 min-h-0">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="font-semibold">Automação Diária</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Executar automaticamente todo dia</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} className="data-[state=checked]:bg-black" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adjustment">Ajuste de Preço</Label>
              <CurrencyInput id="adjustment" value={priceAdjustment} onChange={(e) => setPriceAdjustment(e.target.value)} placeholder="-0.01" />
              <p className="text-xs text-muted-foreground">Valor negativo = redução. Ex: -0.01 retira $0.01 de cada SKU.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="runtime">Horário de Execução</Label>
              <Input id="runtime" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} />
              <p className="text-xs text-muted-foreground">Horário de Brasília (BRT).</p>
            </div>

            <div className="space-y-1.5">
              <Label>Dias da Semana</Label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map((day) => {
                  const active = activeWeekdays.includes(day.value);
                  return (
                    <button key={day.value} type="button" onClick={() => toggleWeekday(day.value)}
                      className={`h-9 w-12 rounded-md text-xs font-medium border transition-colors ${active ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"}`}>
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isEnabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">Automação desativada. Ative para iniciar o agendamento diário.</AlertDescription>
              </Alert>
            )}

            {lastRun?.at && (
              <div className="p-3 border rounded-lg space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Última execução automática</p>
                <div className="flex items-center gap-2 text-sm">
                  {lastRun.status === "success" ? <CheckCircle2 className="h-4 w-4 text-foreground" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span>{new Date(lastRun.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                </div>
                {lastRun.status === "success" ? (
                  <p className="text-xs text-muted-foreground">{lastRun.updated} de {lastRun.total} SKU(s) atualizado(s)</p>
                ) : (
                  <p className="text-xs text-destructive">{lastRun.error}</p>
                )}
              </div>
            )}

            <Button className="w-full bg-black hover:bg-black/80 text-white" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : settingsSaved ? (<><CheckCircle2 className="mr-2 h-4 w-4" />Salvo!</>) : (<><Save className="mr-2 h-4 w-4" />Salvar Configurações</>)}
            </Button>

            <Button className="w-full" variant="outline" disabled={!isConnected || activeAction !== null} onClick={() => handleRun("full")}>
              {activeAction === "full" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Atualizando SKUs no TikTok Shop...</>) : (<><Play className="mr-2 h-4 w-4" />Executar em Todos os SKUs</>)}
            </Button>

            {activeAction === "full" && runProgress && runProgress.total > 0 && (
              <div className="space-y-1.5">
                <Progress value={(runProgress.completed / runProgress.total) * 100} />
                <p className="text-xs text-center text-muted-foreground">{runProgress.completed} de {runProgress.total} SKUs atualizados</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:h-[760px]">
          <CardHeader>
            <CardTitle>Selecionar SKUs</CardTitle>
            <CardDescription>Escolha exatamente quais SKUs do TikTok Shop recebem o ajuste de preço</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título ou SKU..." value={listingSearch} onChange={(e) => setListingSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{loadingListings ? "Carregando..." : `${filteredListings.length} SKU(s) · ${selectedSkuIds.size} selecionado(s)`}</span>
              <div className="flex gap-3">
                <button type="button" className="underline hover:text-foreground" onClick={() => setSelectedSkuIds(new Set(filteredListings.map((l) => l.skuId)))}>Selecionar todos</button>
                <button type="button" className="underline hover:text-foreground" onClick={() => setSelectedSkuIds(new Set())}>Limpar</button>
              </div>
            </div>

            <div className="border rounded-lg overflow-y-auto flex-1 min-h-[280px]">
              {loadingListings ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Carregando listings do TikTok Shop...</span>
                </div>
              ) : (
                <>
                  {filteredListings.map((l) => (
                    <label key={l.skuId} className="flex items-center gap-3 p-2.5 border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <Checkbox checked={selectedSkuIds.has(l.skuId)} onCheckedChange={() => toggleListingSelection(l.skuId)} />
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0 bg-muted" />
                      ) : (
                        <div className="h-10 w-10 rounded shrink-0 bg-muted" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.title}</p>
                        <p className="text-xs text-muted-foreground">SKU: {l.skuId}</p>
                      </div>
                      <span className="text-sm font-semibold shrink-0">${l.price.toFixed(2)}</span>
                    </label>
                  ))}
                  {filteredListings.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum listing encontrado</p>}
                </>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Como aplicar aos selecionados</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setSelectionMode("adjustment")} className={`h-9 rounded-md text-xs font-medium border transition-colors px-2 ${selectionMode === "adjustment" ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"}`}>Ajuste de Preço</button>
                <button type="button" onClick={() => setSelectionMode("fixed")} className={`h-9 rounded-md text-xs font-medium border transition-colors px-2 ${selectionMode === "fixed" ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"}`}>Preço Único</button>
              </div>

              {selectionMode === "adjustment" ? (
                <CurrencyInput value={selectionAdjustment} onChange={(e) => setSelectionAdjustment(e.target.value)} placeholder="-0.01" />
              ) : (
                <CurrencyInput value={selectionFixedPrice} onChange={(e) => setSelectionFixedPrice(e.target.value)} placeholder="19.99" />
              )}
            </div>

            <Button className="w-full bg-black hover:bg-black/80 text-white" disabled={selectedSkuIds.size === 0 || activeAction !== null || !isConnected || selectionValueInvalid} onClick={() => handleRun("select", [...selectedSkuIds])}>
              {activeAction === "select" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando...</>) : (<><ListChecks className="mr-2 h-4 w-4" />Aplicar {selectionMode === "fixed" ? "Preço" : "Ajuste"} em {selectedSkuIds.size} Selecionado(s)</>)}
            </Button>

            {activeAction === "select" && runProgress && runProgress.total > 0 && (
              <div className="space-y-1.5">
                <Progress value={(runProgress.completed / runProgress.total) * 100} />
                <p className="text-xs text-center text-muted-foreground">{runProgress.completed} de {runProgress.total} SKUs atualizados</p>
              </div>
            )}

            {!isConnected && <p className="text-xs text-center text-muted-foreground">Conecte sua conta TikTok Shop acima para habilitar a execução</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
          <CardDescription>Relatório das últimas automações realizadas no TikTok Shop</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><p>Nenhuma execução registrada ainda</p></div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {log.status === "success" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                    <div>
                      <p className="font-medium text-sm">{log.date}</p>
                      <p className="text-xs text-muted-foreground">{log.status === "error" && !log.total ? (log.error || "Falha na execução") : `${log.updated}/${log.total} SKUs atualizados no TikTok Shop`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{log.trigger === "scheduled" ? "Automático" : "Manual"}</Badge>
                    <Badge variant={log.mode === "full" ? "default" : "outline"} className="text-xs">{log.mode === "test" ? "Teste" : log.mode === "select" ? "Selecionados" : "Completo"}</Badge>
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
                <div className="p-3 rounded-lg bg-muted text-center"><p className="text-2xl font-bold">{selectedLog.total}</p><p className="text-xs text-muted-foreground">Total de SKUs</p></div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-center"><p className="text-2xl font-bold text-green-600">{selectedLog.updated}</p><p className="text-xs text-muted-foreground">Atualizados</p></div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-center"><p className="text-2xl font-bold text-red-600">{selectedLog.total - selectedLog.updated}</p><p className="text-xs text-muted-foreground">Com Erro</p></div>
              </div>
              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr><th className="text-left p-3 font-medium">SKU (TikTok Shop)</th><th className="text-right p-3 font-medium">Preço Antigo</th><th className="text-right p-3 font-medium">Novo Preço</th><th className="text-center p-3 font-medium">Status</th></tr>
                  </thead>
                  <tbody>
                    {selectedLog.products.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3"><p className="font-medium leading-tight">{p.title}</p><p className="text-xs text-muted-foreground">SKU: {p.sku}</p>{p.error && <p className="text-xs text-red-500 mt-0.5">{p.error}</p>}</td>
                        <td className="p-3 text-right text-muted-foreground">${p.oldPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-medium">${p.newPrice.toFixed(2)}</td>
                        <td className="p-3 text-center">{p.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-red-500 mx-auto" />}</td>
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
