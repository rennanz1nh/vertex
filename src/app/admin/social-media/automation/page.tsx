"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/admin-fetch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AutomationSettings {
  watch_folder_enabled: boolean;
  auto_analysis: boolean;
  auto_generate_captions: boolean;
  auto_generate_hashtags: boolean;
  require_approval: boolean;
  auto_publish_enabled: boolean;
  default_account_ids: Record<string, string>;
  metrics_sync_interval_minutes: number;
}

interface ConnectedAccount {
  accountId: string | null;
  platform: string;
  connected: boolean;
  canPublish: boolean;
  accountName: string | null;
  label: string;
}

const TOGGLES: { key: keyof AutomationSettings; label: string; description: string }[] = [
  {
    key: "watch_folder_enabled",
    label: "Pasta automática (inbox)",
    description: "Verifica a cada 5 min por novos vídeos na pasta inbox/ e processa automaticamente.",
  },
  {
    key: "auto_analysis",
    label: "Análise automática",
    description: "Analisa vídeos novos com IA (Claude vision) assim que entram.",
  },
  {
    key: "auto_generate_captions",
    label: "Gerar legendas automaticamente",
    description: "Gera título e legenda por plataforma depois da análise.",
  },
  {
    key: "auto_generate_hashtags",
    label: "Gerar hashtags automaticamente",
    description: "Gerado junto com a legenda (não é possível separar apenas hashtags).",
  },
  {
    key: "require_approval",
    label: "Exigir aprovação humana",
    description: "Informativo — toda publicação sempre nasce como PENDING_APPROVAL; isso não pode ser desligado por segurança.",
  },
  {
    key: "auto_publish_enabled",
    label: "Modo AUTO (publicar sem revisão)",
    description: "Chave geral. Só afeta contas que também tiverem 'Publicar automaticamente' ativado no HUB — veja a página HUB.",
  },
];

const GENERATABLE_PLATFORMS = ["instagram", "tiktok"] as const;

export default function SocialMediaAutomationPage() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [accountDrafts, setAccountDrafts] = useState<Record<string, string>>({});
  const [savingAccounts, setSavingAccounts] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const [settingsRes, statusRes] = await Promise.all([authedFetch("/api/social-media/automation-settings"), authedFetch("/api/social/status")]);
    const settingsData = await settingsRes.json();
    const statusData = await statusRes.json();
    if (settingsRes.ok) {
      setSettings(settingsData.settings);
      setAccountDrafts(settingsData.settings.default_account_ids ?? {});
    }
    if (statusRes.ok) setAccounts(statusData.platforms ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (key: keyof AutomationSettings, value: boolean) => {
    setSavingKey(key);
    try {
      const res = await authedFetch("/api/social-media/automation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao salvar", description: data.error, variant: "destructive" });
        return;
      }
      setSettings(data.settings);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAccounts = async () => {
    setSavingAccounts(true);
    try {
      const cleaned = Object.fromEntries(Object.entries(accountDrafts).filter(([, v]) => v));
      const res = await authedFetch("/api/social-media/automation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_account_ids: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao salvar", description: data.error, variant: "destructive" });
        return;
      }
      setSettings(data.settings);
      toast({ title: "Contas padrão salvas" });
    } finally {
      setSavingAccounts(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Automação</h1>
        <p className="text-sm text-muted-foreground">Controla o que roda sozinho na pasta automática e no modo AUTO.</p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {TOGGLES.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              {savingKey === key ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Switch
                  checked={Boolean(settings[key])}
                  disabled={key === "require_approval"}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas padrão da automação</CardTitle>
          <CardDescription>
            Quando a pasta automática ou process_video geram conteúdo, essa é a conta usada para criar a publicação em cada plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {GENERATABLE_PLATFORMS.map((platform) => {
            const platformAccounts = accounts.filter((a) => a.platform === platform && a.connected);
            return (
              <div key={platform} className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground w-20 shrink-0">{platform}</span>
                <Select
                  value={accountDrafts[platform] ?? ""}
                  onValueChange={(value) => setAccountDrafts((prev) => ({ ...prev, [platform]: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={platformAccounts.length === 0 ? "Nenhuma conta conectada" : "Nenhuma (não criar publicação)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {platformAccounts.map((a) => (
                      <SelectItem key={a.accountId} value={a.accountId ?? ""}>
                        {a.accountName ?? platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          <Button size="sm" onClick={handleSaveAccounts} disabled={savingAccounts}>
            {savingAccounts && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar contas padrão
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <p className="text-xs text-muted-foreground">
        Sincronização de métricas: agenda de recuo fixa (10min → 1h → 6h → 24h → 48h → 7d → semanal) rodando a cada 10 minutos via cron — o campo
        metrics_sync_interval_minutes do banco ainda não altera essa cadência.
      </p>
    </div>
  );
}
