"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Bell, Save, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { authedFetch } from "@/lib/admin-fetch";
import type { PushTriggerKey } from "@/lib/notify";
import { PUSH_SAMPLE_VARS } from "@/lib/push-notifications-sample-vars";

type MasterSettings = { enabled: boolean; ntfy_topic: string | null };

const MASTER_DEFAULTS: MasterSettings = { enabled: true, ntfy_topic: "" };

type PushNotification = {
  trigger_key: PushTriggerKey;
  enabled: boolean;
  title: string;
  message: string;
  tags: string | null;
};

const LABELS: Record<PushTriggerKey, { title: string; description: string; vars: string[] }> = {
  ebay_price_success: {
    title: "eBay: preços atualizados",
    description: "Automação de preços do eBay rodou com sucesso.",
    vars: ["trigger", "mode", "updated", "total"],
  },
  ebay_price_error: {
    title: "eBay: falha na automação de preço",
    description: "A automação de preços do eBay falhou.",
    vars: ["trigger", "mode", "error"],
  },
  amazon_price_success: {
    title: "Amazon: preços atualizados",
    description: "Automação de preços da Amazon rodou com sucesso.",
    vars: ["trigger", "mode", "updated", "total"],
  },
  amazon_price_error: {
    title: "Amazon: falha na automação de preço",
    description: "A automação de preços da Amazon falhou.",
    vars: ["trigger", "mode", "error"],
  },
  tiktok_price_success: {
    title: "TikTok Shop: preços atualizados",
    description: "Automação de preços do TikTok Shop rodou com sucesso.",
    vars: ["trigger", "mode", "updated", "total"],
  },
  tiktok_price_error: {
    title: "TikTok Shop: falha na automação de preço",
    description: "A automação de preços do TikTok Shop falhou.",
    vars: ["trigger", "mode", "error"],
  },
  google_shopping_success: {
    title: "Google Shopping: produtos sincronizados",
    description: "Sincronização do feed do Google Shopping rodou com sucesso.",
    vars: ["trigger", "mode", "synced", "total"],
  },
  google_shopping_error: {
    title: "Google Shopping: falha na sincronização",
    description: "A sincronização do feed do Google Shopping falhou.",
    vars: ["trigger", "mode", "error"],
  },
  new_chat_message: {
    title: "Novo chat",
    description: "Um visitante enviou uma mensagem no chat do site.",
    vars: ["who", "preview"],
  },
  new_visit: {
    title: "Nova visita ao site",
    description: "Alguém abriu uma página da loja (uma vez por sessão de navegador).",
    vars: ["path", "location"],
  },
  checkout_started: {
    title: "Checkout iniciado",
    description: "Uma sessão de checkout foi criada no Stripe (o cliente foi para a etapa de pagamento).",
    vars: ["amount", "location"],
  },
  daily_report: {
    title: "Resumo diário disponível",
    description: "Enviado toda manhã (08:00) com o link para o Resumo Diário (vendas, acessos e catálogo do dia anterior).",
    vars: ["revenue", "sessions"],
  },
  ebay_offers_eligible: {
    title: "eBay: novas ofertas disponíveis",
    description: "Enviado quando um anúncio do eBay passa a ter watchers/carrinho abandonado elegíveis para receber uma oferta com desconto (verificado a cada 4h).",
    vars: ["count"],
  },
  new_order: {
    title: "Nova venda",
    description: "Enviado assim que qualquer pedido novo é registrado (eBay, Amazon, TikTok Shop, site ou manual), direto do banco de dados.",
    vars: ["canal", "total"],
  },
};

const ORDER: PushTriggerKey[] = [
  "ebay_price_success",
  "ebay_price_error",
  "amazon_price_success",
  "amazon_price_error",
  "tiktok_price_success",
  "tiktok_price_error",
  "google_shopping_success",
  "google_shopping_error",
  "new_chat_message",
  "new_visit",
  "checkout_started",
  "daily_report",
  "ebay_offers_eligible",
  "new_order",
];

function renderPreview(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function PushNotificationRow({ item, onSaved }: { item: PushNotification; onSaved: (n: PushNotification) => void }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const info = LABELS[item.trigger_key];
  const sampleVars = PUSH_SAMPLE_VARS[item.trigger_key];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await authedFetch(`/api/push-notifications/${item.trigger_key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: form.enabled, title: form.title, message: form.message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.notification);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authedFetch(`/api/push-notifications/${item.trigger_key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, message: form.message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error || "Falha ao enviar" });
        return;
      }
      setTestResult({ ok: true, message: "Enviado — confira seu celular." });
    } catch {
      setTestResult({ ok: false, message: "Falha na conexão" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AccordionItem value={item.trigger_key}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => {
                setForm((f) => ({ ...f, enabled: checked }));
                authedFetch(`/api/push-notifications/${item.trigger_key}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: checked }),
                }).then(() => onSaved({ ...form, enabled: checked }));
              }}
            />
          </span>
          <div className="text-left">
            <div className="font-medium">{info.title}</div>
            <div className="text-xs text-muted-foreground font-normal">{info.description}</div>
          </div>
          {!form.enabled && <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">Desativado</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            <p className="text-xs text-muted-foreground">Placeholders: {info.vars.map((v) => `{${v}}`).join(", ")}</p>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
            <p className="font-medium text-muted-foreground mb-1">Prévia</p>
            <p className="font-semibold">{renderPreview(form.title, sampleVars)}</p>
            <p className="text-muted-foreground whitespace-pre-line">{renderPreview(form.message, sampleVars)}</p>
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"} className="py-2">
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Enviar teste
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function SettingsPage() {
  const [master, setMaster] = useState<MasterSettings>(MASTER_DEFAULTS);
  const [notifications, setNotifications] = useState<PushNotification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      authedFetch("/api/settings/notifications").then((r) => r.json()),
      authedFetch("/api/push-notifications").then((r) => r.json()),
    ])
      .then(([settingsData, pushData]) => {
        if (settingsData.settings) {
          setMaster({ enabled: !!settingsData.settings.enabled, ntfy_topic: settingsData.settings.ntfy_topic || "" });
        }
        setNotifications(pushData.notifications ?? []);
      })
      .catch(() => setError("Falha ao carregar configurações"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveMaster() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await authedFetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(master),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao salvar configurações");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Falha na conexão ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  function updateLocal(updated: PushNotification) {
    setNotifications((prev) => (prev ? prev.map((n) => (n.trigger_key === updated.trigger_key ? updated : n)) : prev));
  }

  const sorted = notifications ? [...notifications].sort((a, b) => ORDER.indexOf(a.trigger_key) - ORDER.indexOf(b.trigger_key)) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Preferências gerais do sistema</p>
        </div>
      </div>

      <SettingsTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações por Celular
          </CardTitle>
          <CardDescription>
            Receba um push no celular via{" "}
            <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              ntfy
            </a>
            . Instale o app e assine o tópico configurado abaixo — depois, controle cada tipo de notificação individualmente na lista logo abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="font-semibold">Notificações Ativadas</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Chave geral — desative para parar tudo de uma vez, sem perder as configurações de cada tipo</p>
            </div>
            <Switch
              checked={master.enabled}
              onCheckedChange={(v) => setMaster((s) => ({ ...s, enabled: v }))}
              className="data-[state=checked]:bg-black"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ntfy_topic">Tópico ntfy.sh</Label>
            <Input
              id="ntfy_topic"
              value={master.ntfy_topic ?? ""}
              onChange={(e) => setMaster((s) => ({ ...s, ntfy_topic: e.target.value }))}
              placeholder="ex: cosmetic-mkt-price-auto-9551389cc618"
            />
            <p className="text-xs text-muted-foreground">
              Se deixar em branco, usa a variável de ambiente NTFY_TOPIC. Ao trocar o tópico, assine o novo nome no app ntfy no celular.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button className="bg-black hover:bg-black/80 text-white" onClick={handleSaveMaster} disabled={saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : saved ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Salvo!</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Salvar</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Cada notificação</CardTitle>
          <CardDescription>Ligue/desligue e personalize o título e a mensagem de cada aviso que o sistema pode te enviar.</CardDescription>
        </CardHeader>
        <CardContent>
          {!sorted ? (
            <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {sorted.map((n) => (
                <PushNotificationRow key={n.trigger_key} item={n} onSaved={updateLocal} />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
