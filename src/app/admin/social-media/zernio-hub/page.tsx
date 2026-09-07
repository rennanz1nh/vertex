"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Eye, TrendingUp, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InstagramLogo, TikTokLogo } from "@/components/brand-logos";
import { PlatformConnectionCard, type PlatformStatus } from "@/components/social-media/PlatformConnectionCard";
import { authedFetch } from "@/lib/admin-fetch";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <InstagramLogo className="h-5 w-5" />,
  tiktok: <TikTokLogo className="h-5 w-5" />,
};

interface ZernioInsights {
  reach: number | null;
  totalInteractions: number | null;
  accountsEngaged: number | null;
  followerCount: number | null;
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

// Sibling to /admin/social-media/hub, wired to Zernio (zernio.com) instead of native
// Meta/TikTok OAuth — Zernio owns its own already-approved developer apps, so accounts
// connect and can publish here without waiting on Meta App Review / TikTok's audit.
// Scope note: connect/disconnect + Instagram account-insights only. Publishing here
// isn't wired into the approval queue/scheduler yet — that's the natural next step once
// this connection has been used for real.
export default function SocialMediaHubZernio() {
  const { toast } = useToast();

  const [platforms, setPlatforms] = useState<PlatformStatus[] | null>(null);
  const [selected, setSelected] = useState<string>("instagram");
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [insights, setInsights] = useState<ZernioInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await authedFetch("/api/social/zernio/status");
    const data = await res.json();
    if (data.platforms) setPlatforms(data.platforms);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Feedback from the Zernio callback redirect (?social_connected=x / ?social_error=x) —
  // same convention as the native HUB page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const error = params.get("social_error");
    const platform = params.get("social_platform");
    if (connected) {
      toast({ title: "Conectado!", description: `Conta de ${connected} conectada via Zernio.` });
      loadStatus();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      toast({ title: `Erro ao conectar${platform ? ` (${platform})` : ""}`, description: error, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInsights = useCallback(async (platform: string) => {
    setLoadingInsights(true);
    setInsightsError(null);
    setInsights(null);
    try {
      const res = await authedFetch(`/api/social/zernio/${platform}/insights`);
      const data = await res.json();
      if (!res.ok) {
        setInsightsError(data.error ?? "Falha ao carregar métricas");
      } else {
        setInsights(data);
      }
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  useEffect(() => {
    const current = platforms?.find((p) => p.platform === selected);
    if (current?.connected && selected === "instagram") loadInsights(selected);
    else {
      setInsights(null);
      setInsightsError(null);
    }
  }, [selected, platforms, loadInsights]);

  const handleConnect = (platform: string) => {
    const status = platforms?.find((p) => p.platform === platform);
    if (status && !status.configured) {
      toast({
        title: "Zernio não configurado",
        description: "Crie uma conta em zernio.com e configure ZERNIO_API_KEY e ZERNIO_PROFILE_ID no servidor antes de conectar.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = `/api/social/zernio/${platform}/connect?returnTo=${encodeURIComponent("/admin/social-media/zernio-hub")}`;
  };

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      await authedFetch(`/api/social/zernio/${platform}/disconnect`, { method: "POST" });
      await loadStatus();
      toast({ title: "Desconectado", description: `Conta de ${platform} desconectada.` });
    } finally {
      setDisconnecting(null);
    }
  };

  const selectedStatus = platforms?.find((p) => p.platform === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">HUB (Zernio)</h1>
        <p className="text-muted-foreground text-sm">
          Conexões de Instagram e TikTok via Zernio — um app já aprovado pelo Meta e pelo TikTok, então publicar funciona sem esperar a revisão deles.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {platforms
          ? platforms.map((p) => (
              <PlatformConnectionCard
                key={p.platform}
                status={p}
                icon={PLATFORM_ICONS[p.platform]}
                active={selected === p.platform}
                disconnecting={disconnecting === p.platform}
                onSelect={() => setSelected(p.platform)}
                onConnect={() => handleConnect(p.platform)}
                onDisconnect={() => handleDisconnect(p.platform)}
              />
            ))
          : [0, 1].map((i) => <Skeleton key={i} className="flex-1 min-w-[200px] h-[104px] rounded-lg" />)}
      </div>

      {selectedStatus?.connected && selected === "instagram" ? (
        <div className="space-y-4">
          {insightsError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {insightsError}
            </div>
          )}
          {!insightsError && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Seguidores", icon: Users, value: insights?.followerCount ?? null },
                { label: "Alcance", icon: Eye, value: insights?.reach ?? null },
                { label: "Interações", icon: TrendingUp, value: insights?.totalInteractions ?? null },
                { label: "Contas alcançadas", icon: UserCheck, value: insights?.accountsEngaged ?? null },
              ].map(({ label, icon: Icon, value }) => (
                <Card key={label}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{loadingInsights ? <Skeleton className="h-8 w-20" /> : formatNumber(value)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {selectedStatus?.connected
              ? `Conta de ${selectedStatus.label} conectada via Zernio. Métricas por aqui ainda só existem pro Instagram — e a publicação automática pela fila de aprovação ainda usa o caminho nativo.`
              : selectedStatus?.configured
                ? `Conecte sua conta do ${selectedStatus?.label} acima.`
                : "Configure ZERNIO_API_KEY e ZERNIO_PROFILE_ID no servidor para poder conectar."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
