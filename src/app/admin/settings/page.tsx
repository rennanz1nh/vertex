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
import { Settings as SettingsIcon, Smartphone, Save, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { BookingAlertsCard } from "@/components/admin/BookingAlertsCard";
import { authedFetch } from "@/lib/admin-fetch";
import { useToast } from "@/hooks/use-toast";
import { PUSH_CATALOG, PUSH_CATALOG_BY_KEY, PUSH_GROUPS, type PushCatalogEntry } from "@/lib/push-catalog";

type MasterSettings = { enabled: boolean; ntfy_topic: string };

type PushNotification = {
  trigger_key: PushCatalogEntry["key"];
  enabled: boolean;
  title: string;
  message: string;
  tags: string | null;
  customized: boolean;
};

function renderPreview(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

async function patchNotification(key: string, body: Record<string, unknown>): Promise<PushNotification> {
  const res = await authedFetch(`/api/push-notifications/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao salvar");
  return data.notification as PushNotification;
}

function NotificationRow({ item, entry, masterOn, onChange }: {
  item: PushNotification;
  entry: PushCatalogEntry;
  masterOn: boolean;
  onChange: (n: PushNotification) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(item.title);
  const [message, setMessage] = useState(item.message);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function toggle(enabled: boolean) {
    onChange({ ...item, enabled }); // optimistic
    try {
      onChange(await patchNotification(item.trigger_key, { enabled }));
    } catch (e) {
      onChange({ ...item, enabled: !enabled });
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function saveText() {
    setSaving(true);
    try {
      onChange(await patchNotification(item.trigger_key, { title, message }));
      toast({ title: "Texto salvo" });
    } catch (e) {
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authedFetch(`/api/push-notifications/${item.trigger_key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, message: "Enviado. Confira o celular." } : { ok: false, message: data.error || "Falha ao enviar" });
    } catch {
      setTestResult({ ok: false, message: "Falha na conexão" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AccordionItem value={item.trigger_key} className="border-b last:border-b-0">
      <div className="flex items-start gap-3 py-3">
        <Switch
          checked={item.enabled}
          onCheckedChange={toggle}
          aria-label={`${item.enabled ? "Desligar" : "Ligar"} ${entry.label}`}
          className="mt-0.5 data-[state=checked]:bg-black"
        />
        <div className={`min-w-0 flex-1 ${item.enabled && masterOn ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{entry.label}</span>
            {!item.enabled && <Badge variant="secondary" className="text-[10px]">Desligado</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
        </div>
        <AccordionTrigger className="py-0 text-xs text-muted-foreground hover:no-underline shrink-0">Editar</AccordionTrigger>
      </div>
      <AccordionContent>
        <div className="space-y-4 pb-2 pl-12">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-muted-foreground">Variáveis: {Object.keys(entry.sample).map((v) => `{${v}}`).join(", ")}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
            <p className="font-medium text-muted-foreground mb-1">Prévia</p>
            <p className="font-semibold">{renderPreview(title, entry.sample)}</p>
            <p className="text-muted-foreground whitespace-pre-line">{renderPreview(message, entry.sample)}</p>
          </div>
          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"} className="py-2">
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setTitle(entry.title); setMessage(entry.message); }}>
              Texto padrão
            </Button>
            <Button size="sm" variant="outline" onClick={test} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Enviar teste
            </Button>
            <Button size="sm" onClick={saveText} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar texto
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [master, setMaster] = useState<MasterSettings>({ enabled: true, ntfy_topic: "" });
  const [notifications, setNotifications] = useState<PushNotification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      .catch(() => setError("Falha ao carregar as configurações"))
      .finally(() => setLoading(false));
  }, []);

  async function saveMaster(next: MasterSettings) {
    setSaving(true);
    try {
      const res = await authedFetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      setMaster({ enabled: !!data.settings.enabled, ntfy_topic: data.settings.ntfy_topic || "" });
      toast({ title: "Salvo" });
    } catch (e) {
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function setAll(enabled: boolean) {
    if (!notifications) return;
    const prev = notifications;
    setNotifications(prev.map((n) => ({ ...n, enabled })));
    const results = await Promise.allSettled(prev.filter((n) => n.enabled !== enabled).map((n) => patchNotification(n.trigger_key, { enabled })));
    if (results.some((r) => r.status === "rejected")) {
      toast({ title: "Alguns avisos não foram salvos", variant: "destructive" });
      setNotifications(prev);
    }
  }

  function updateLocal(updated: PushNotification) {
    setNotifications((prev) => (prev ? prev.map((n) => (n.trigger_key === updated.trigger_key ? { ...n, ...updated } : n)) : prev));
  }

  const byKey = new Map((notifications ?? []).map((n) => [n.trigger_key, n]));
  const onCount = (notifications ?? []).filter((n) => n.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Notificações e preferências do sistema</p>
        </div>
      </div>

      <SettingsTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : (
        <>
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Notificações no celular
              </CardTitle>
              <CardDescription>
                Pelo app{" "}
                <a href="https://ntfy.sh" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">ntfy</a>
                : instale, toque em + e assine o tópico abaixo. Quem tiver o nome do tópico recebe os avisos, então não divulgue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-muted/30">
                <div>
                  <Label className="font-semibold">Todas as notificações</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Chave geral: desligue para pausar tudo sem perder as escolhas abaixo.</p>
                </div>
                <Switch
                  checked={master.enabled}
                  disabled={saving}
                  onCheckedChange={(v) => saveMaster({ ...master, enabled: v })}
                  className="data-[state=checked]:bg-black"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ntfy_topic">Tópico ntfy</Label>
                <div className="flex gap-2">
                  <Input id="ntfy_topic" value={master.ntfy_topic} onChange={(e) => setMaster((s) => ({ ...s, ntfy_topic: e.target.value }))} placeholder="ex: vertex-reservas-1a2b3c" />
                  <Button className="bg-black hover:bg-black/80 text-white shrink-0" onClick={() => saveMaster(master)} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="ml-2">Salvar</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-3xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>O que avisar</CardTitle>
                  <CardDescription>
                    {onCount} de {PUSH_CATALOG.length} ligados. Ligue ou desligue cada aviso; em &quot;Editar&quot; você muda o texto e manda um teste.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAll(true)}>Ligar todos</Button>
                  <Button size="sm" variant="outline" onClick={() => setAll(false)}>Desligar todos</Button>
                </div>
              </div>
              {!master.enabled && (
                <p className="text-xs text-amber-700 mt-2">A chave geral está desligada: nenhum aviso é enviado até você ligá-la acima.</p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {PUSH_GROUPS.map((group) => {
                const entries = PUSH_CATALOG.filter((e) => e.group === group.id);
                return (
                  <div key={group.id}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                    <p className="text-xs text-muted-foreground mb-1">{group.description}</p>
                    <Accordion type="single" collapsible className="w-full">
                      {entries.map((e) => {
                        const item = byKey.get(e.key);
                        if (!item) return null;
                        return <NotificationRow key={e.key} item={item} entry={PUSH_CATALOG_BY_KEY.get(e.key)!} masterOn={master.enabled} onChange={updateLocal} />;
                      })}
                    </Accordion>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <BookingAlertsCard />
        </>
      )}
    </div>
  );
}
